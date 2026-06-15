"use strict";

const els = {};
let priceChart = null;

document.addEventListener("DOMContentLoaded", () => {
  for (const id of [
    "workerUrl", "token", "saveConn", "connStatus", "app",
    "newTargetType", "newTargetValue", "addTarget", "targetsTable",
    "diffTarget", "loadDiff", "diffSummary", "diffDetails",
    "offerId", "loadHistory", "priceChart", "historyMeta",
  ]) {
    els[id] = document.getElementById(id);
  }

  els.workerUrl.value = localStorage.getItem("workerUrl") || "";
  els.token.value = localStorage.getItem("token") || "";

  els.saveConn.addEventListener("click", connect);
  els.addTarget.addEventListener("click", addTarget);
  els.loadDiff.addEventListener("click", loadDiff);
  els.loadHistory.addEventListener("click", loadHistory);

  if (els.workerUrl.value && els.token.value) connect();
});

function cfg() {
  return {
    url: (localStorage.getItem("workerUrl") || "").replace(/\/+$/, ""),
    token: localStorage.getItem("token") || "",
  };
}

async function api(path, options = {}) {
  const { url, token } = cfg();
  const resp = await fetch(url + path, {
    ...options,
    headers: {
      authorization: "Bearer " + token,
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  return data;
}

async function connect() {
  localStorage.setItem("workerUrl", els.workerUrl.value.trim());
  localStorage.setItem("token", els.token.value.trim());
  setStatus(els.connStatus, "Łączenie…", "");
  try {
    await api("/targets?active=1");
    setStatus(els.connStatus, "Połączono.", "ok");
    els.app.hidden = false;
    await loadTargets();
  } catch (e) {
    setStatus(els.connStatus, "Błąd połączenia: " + e.message, "error");
    els.app.hidden = true;
  }
}

async function loadTargets() {
  const { targets } = await api("/targets");
  const tbody = els.targetsTable.querySelector("tbody");
  tbody.innerHTML = "";
  els.diffTarget.innerHTML = "";

  for (const t of targets) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(t.target_type)}</td>
      <td>${esc(t.target_value)}</td>
      <td>${t.is_active ? "tak" : "nie"}</td>
      <td></td>`;
    const btn = document.createElement("button");
    btn.className = "secondary";
    btn.textContent = t.is_active ? "Wyłącz" : "Włącz";
    btn.addEventListener("click", () => toggleTarget(t.id, !t.is_active));
    tr.lastElementChild.appendChild(btn);
    tbody.appendChild(tr);

    const opt = document.createElement("option");
    opt.value = JSON.stringify({ type: t.target_type, value: t.target_value });
    opt.textContent = `${t.target_type}: ${t.target_value}`;
    els.diffTarget.appendChild(opt);
  }
}

async function addTarget() {
  const value = els.newTargetValue.value.trim();
  if (!value) return;
  try {
    await api("/targets", {
      method: "POST",
      body: JSON.stringify({
        target_type: els.newTargetType.value,
        target_value: value,
      }),
    });
    els.newTargetValue.value = "";
    await loadTargets();
  } catch (e) {
    alert("Nie udało się dodać: " + e.message);
  }
}

async function toggleTarget(id, active) {
  await api(`/targets/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: active }),
  });
  await loadTargets();
}

async function loadDiff() {
  const sel = els.diffTarget.value;
  if (!sel) return;
  const { type, value } = JSON.parse(sel);
  els.diffSummary.innerHTML = "";
  els.diffDetails.innerHTML = "Ładowanie…";
  try {
    const q = `target_type=${encodeURIComponent(type)}&target_value=${encodeURIComponent(value)}`;
    const d = await api(`/diff?${q}`);
    renderDiff(d);
  } catch (e) {
    els.diffDetails.innerHTML = "";
    setStatusText(els.diffDetails, "Błąd: " + e.message, "error");
  }
}

function renderDiff(d) {
  els.diffSummary.innerHTML = `
    <span class="chip">Zmiany cen <b>${d.summary.price_changes}</b></span>
    <span class="chip">Nowe oferty <b>${d.summary.new_offers}</b></span>
    <span class="chip">Zniknięte <b>${d.summary.removed_offers}</b></span>
    <span class="chip">Zmiany pozycji <b>${d.summary.position_changes}</b></span>
    <span class="chip">${esc(d.from_run)} → ${esc(d.to_run)}</span>`;

  const parts = [];
  if (d.price_changes.length) {
    parts.push(group("Zmiany cen", d.price_changes.map((c) => {
      const dir = c.delta > 0 ? "delta-up" : "delta-down";
      const sign = c.delta > 0 ? "+" : "";
      return `${esc(c.title)} — ${c.old_price} → ${c.new_price} zł
        <span class="${dir}">(${sign}${c.delta})</span>`;
    })));
  }
  if (d.new_offers.length) {
    parts.push(group("Nowe oferty", d.new_offers.map(
      (o) => `${esc(o.title)} — ${o.price} zł`)));
  }
  if (d.removed_offers.length) {
    parts.push(group("Zniknięte oferty", d.removed_offers.map(
      (o) => `${esc(o.title)} — ${o.price} zł`)));
  }
  if (d.position_changes.length) {
    parts.push(group("Zmiany pozycji", d.position_changes.map(
      (p) => `${esc(p.title)} — #${p.old_position} → #${p.new_position}`)));
  }
  els.diffDetails.innerHTML = parts.join("") || "<p class='status'>Brak zmian.</p>";
}

function group(title, items) {
  return `<div class="diff-group"><h3>${esc(title)}</h3>` +
    items.map((i) => `<div>${i}</div>`).join("") + `</div>`;
}

async function loadHistory() {
  const id = els.offerId.value.trim();
  if (!id) return;
  setStatus(els.historyMeta, "Ładowanie…", "");
  try {
    const { history } = await api(`/offers?offer_id=${encodeURIComponent(id)}`);
    if (!history.length) {
      setStatus(els.historyMeta, "Brak historii dla tej oferty.", "error");
      return;
    }
    renderChart(history);
    setStatus(els.historyMeta,
      `${esc(history[0].title)} — ${history.length} punktów`, "ok");
  } catch (e) {
    setStatus(els.historyMeta, "Błąd: " + e.message, "error");
  }
}

function renderChart(history) {
  const labels = history.map((h) => h.scraped_at.slice(0, 10));
  const data = history.map((h) => h.price);
  if (priceChart) priceChart.destroy();
  priceChart = new Chart(els.priceChart, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Cena (zł)",
        data,
        borderColor: "#ff5a00",
        backgroundColor: "rgba(255,90,0,0.15)",
        tension: 0.2,
        fill: true,
      }],
    },
    options: {
      scales: {
        x: { ticks: { color: "#9aa0ad" }, grid: { color: "#2a2f3d" } },
        y: { ticks: { color: "#9aa0ad" }, grid: { color: "#2a2f3d" } },
      },
      plugins: { legend: { labels: { color: "#e6e8ee" } } },
    },
  });
}

function setStatus(el, text, cls) {
  el.textContent = text;
  el.className = "status" + (cls ? " " + cls : "");
}
function setStatusText(el, text, cls) {
  el.innerHTML = `<p class="status ${cls}">${esc(text)}</p>`;
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}
