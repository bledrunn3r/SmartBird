import httpx
from datetime import date

WMO_DESCRIPTIONS = {
    0: "Ciel dégagé",
    1: "Principalement dégagé", 2: "Partiellement nuageux", 3: "Couvert",
    45: "Brouillard", 48: "Brouillard givrant",
    51: "Bruine légère", 53: "Bruine modérée", 55: "Bruine forte",
    61: "Pluie légère", 63: "Pluie modérée", 65: "Pluie forte",
    71: "Neige légère", 73: "Neige modérée", 75: "Neige forte",
    80: "Averses légères", 81: "Averses modérées", 82: "Averses violentes",
    95: "Orage", 96: "Orage avec grêle", 99: "Orage violent",
}


async def get_forecast(lat: float, lon: float, threshold_mm: float = 2.0) -> list[dict]:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": lat,
                "longitude": lon,
                "daily": "precipitation_sum,weather_code",
                "timezone": "auto",
                "forecast_days": 7,
            },
        )
        resp.raise_for_status()
        data = resp.json()

    daily = data["daily"]
    result = []
    for dt, precip, code in zip(
        daily["time"], daily["precipitation_sum"], daily["weather_code"]
    ):
        precip = precip or 0.0
        result.append({
            "date": dt,
            "precipitation_mm": precip,
            "weather_code": code,
            "description": WMO_DESCRIPTIONS.get(code, "Inconnu"),
            "will_skip": precip > threshold_mm,
        })
    return result


async def get_today_precipitation(lat: float, lon: float) -> float:
    forecast = await get_forecast(lat, lon, threshold_mm=0)
    today = date.today().isoformat()
    for day in forecast:
        if day["date"] == today:
            return day["precipitation_mm"]
    return 0.0
