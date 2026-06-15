from allegro_sc.parsers import keyword_url, shop_url


def test_keyword_url_from_phrase():
    assert keyword_url("filament petg") == "https://allegro.pl/listing?string=filament%20petg"
    assert keyword_url("filament petg", 2) == "https://allegro.pl/listing?string=filament%20petg&p=2"


def test_shop_url_from_name():
    assert shop_url("Ryobi_Partner") == "https://allegro.pl/uzytkownik/Ryobi_Partner?order=qd"
    assert shop_url("Ryobi_Partner", 3) == "https://allegro.pl/uzytkownik/Ryobi_Partner?order=qd&p=3"


def test_full_url_used_verbatim():
    kw = "https://allegro.pl/listing?string=wiertarka%20ryobi"
    assert keyword_url(kw) == kw
    assert keyword_url(kw, 2) == kw + "&p=2"

    shop = "https://allegro.pl/uzytkownik/Ryobi_Partner"
    assert shop_url(shop) == shop
    assert shop_url(shop, 2) == shop + "?p=2"
