#!/usr/bin/env python3
# Obtiene el dólar blue (dolarhoy.com; con dolarapi.com de respaldo)
# y escribe cotizacion.json. Lo corre la tarea programada mensual.
import re, json, sys, urllib.request, datetime


def fetch(url, timeout=25):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return urllib.request.urlopen(req, timeout=timeout).read().decode("utf-8", "ignore")


def from_dolarhoy():
    h = fetch("https://dolarhoy.com/cotizacion-dolar-blue")
    vals = re.findall(r'class="value"[^>]*>\s*\$?\s*([\d.,]+)', h)
    if len(vals) >= 2:  # [compra, venta]
        return int(round(float(vals[1].replace(".", "").replace(",", "."))))
    return None


def from_dolarapi():
    d = json.loads(fetch("https://dolarapi.com/v1/dolares/blue"))
    return int(round(float(d["venta"])))


def main():
    usd = None
    try:
        usd = from_dolarhoy()
    except Exception as e:
        print("dolarhoy falló:", e, file=sys.stderr)
    if not usd or usd < 100 or usd > 1000000:
        usd = from_dolarapi()

    data = {
        "usd": usd,
        "actualizado": datetime.datetime.utcnow().strftime("%Y-%m-%d"),
        "fuente": "dolar blue (dolarhoy.com)",
    }
    with open("cotizacion.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(json.dumps(data))


if __name__ == "__main__":
    main()
