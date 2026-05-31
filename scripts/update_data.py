"""
Financial Market Data Pipeline
===============================
Fetches index/commodity/stock data, computes technical indicators (MA, MACD,
BOLL, Gann Fans), and writes a structured JSON file consumed by the frontend.

Usage:
    python scripts/update_data.py

Output:
    public/data/market_portfolio.json
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Helpers – graceful import
# ---------------------------------------------------------------------------

def _try_import_akshare():
    try:
        import akshare as ak  # type: ignore
        return ak
    except ImportError:
        return None

def _try_import_yfinance():
    try:
        import yfinance as yf  # type: ignore
        return yf
    except ImportError:
        return None

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

ROOT = Path(__file__).resolve().parent.parent
OUTPUT_PATH = ROOT / "public" / "data" / "market_portfolio.json"

# Indices we track: (code, name, akshare symbol, yfinance ticker)
INDEX_CONFIG = [
    {"code": "000001", "name": "上证指数",   "ak": "sh000001",   "yf": None},
    {"code": "399001", "name": "深证成指",   "ak": "sz399001",   "yf": None},
    {"code": "399006", "name": "创业板指",   "ak": "sz399006",   "yf": None},
    {"code": "000300", "name": "沪深300",    "ak": "sh000300",   "yf": None},
    {"code": "IXIC",   "name": "纳斯达克",   "ak": None,         "yf": "^IXIC"},
    {"code": "XAU",    "name": "黄金 (XAU)", "ak": None,         "yf": "GC=F"},
    {"code": "XAG",    "name": "白银 (XAG)", "ak": None,         "yf": "SI=F"},
]

# Portfolio holdings: (code, name, akshare symbol, yfinance ticker, market)
HOLDING_CONFIG = [
    {"code": "600519", "name": "贵州茅台",   "ak": "sh600519",   "yf": None,       "market": "sh"},
    {"code": "000858", "name": "五粮液",     "ak": "sz000858",   "yf": None,       "market": "sz"},
    {"code": "300750", "name": "宁德时代",   "ak": "sz300750",   "yf": None,       "market": "sz"},
    {"code": "00700",  "name": "腾讯控股",   "ak": None,         "yf": "0700.HK",  "market": "hk"},
    {"code": "00981",  "name": "中芯国际",   "ak": None,         "yf": "0981.HK",  "market": "hk"},
]

LOOKBACK_DAYS = 120          # historical data window
GAN_PIVOT_WINDOW = 5         # window for detecting pivot highs/lows
SUPPORT_RESISTANCE_PCT = 0.02  # ±2% proximity threshold for Gann touches

# ---------------------------------------------------------------------------
# Data fetching
# ---------------------------------------------------------------------------

def _fetch_akshare(symbol: str) -> Optional[pd.DataFrame]:
    """Fetch daily K-line from AkShare.  Returns DataFrame with OHLCV."""
    ak = _try_import_akshare()
    if ak is None:
        print("  [WARN] akshare not installed, skipping")
        return None
    try:
        # akshare stock daily
        clean = symbol.replace("sh", "").replace("sz", "")
        market = "sh" if symbol.startswith("sh") else "sz"
        # For indices, akshare uses different functions
        is_index = clean.startswith("000")
        if is_index:
            df = ak.stock_zh_index_daily(symbol=symbol)
        else:
            df = ak.stock_zh_a_hist(symbol=clean, period="daily", adjust="qfq")
        if df is None or df.empty:
            return None
        # Normalize columns
        df = df.rename(columns={
            "date": "Date", "开盘": "Open", "收盘": "Close",
            "最高": "High", "最低": "Low", "成交量": "Volume",
        })
        if "Date" not in df.columns:
            return None
        df["Date"] = pd.to_datetime(df["Date"])
        df = df.sort_values("Date")
        return df[["Date", "Open", "High", "Low", "Close", "Volume"]]
    except Exception as e:
        print(f"  [WARN] akshare fetch failed for {symbol}: {e}")
        return None


def _fetch_yfinance(ticker: str) -> Optional[pd.DataFrame]:
    """Fetch daily history from Yahoo Finance."""
    yf = _try_import_yfinance()
    if yf is None:
        print("  [WARN] yfinance not installed, skipping")
        return None
    try:
        end = datetime.now()
        start = end - timedelta(days=LOOKBACK_DAYS + 10)
        data = yf.download(ticker, start=start.strftime("%Y-%m-%d"),
                           end=end.strftime("%Y-%m-%d"), progress=False, auto_adjust=True)
        if data is None or data.empty:
            return None
        # Flatten multi-level columns if present
        if isinstance(data.columns, pd.MultiIndex):
            data.columns = data.columns.get_level_values(0)
        data = data.reset_index()
        data["Date"] = pd.to_datetime(data["Date"])
        data = data.rename(columns={
            "Open": "Open", "High": "High", "Low": "Low",
            "Close": "Close", "Volume": "Volume",
        })
        return data[["Date", "Open", "High", "Low", "Close", "Volume"]]
    except Exception as e:
        print(f"  [WARN] yfinance fetch failed for {ticker}: {e}")
        return None


def fetch_price_data(symbol_ak: Optional[str], symbol_yf: Optional[str]) -> Optional[pd.DataFrame]:
    """Try AkShare first, fall back to yfinance."""
    df = None
    if symbol_ak:
        df = _fetch_akshare(symbol_ak)
    if df is None and symbol_yf:
        df = _fetch_yfinance(symbol_yf)
    if df is not None:
        df = df.drop_duplicates(subset=["Date"]).sort_values("Date").reset_index(drop=True)
    return df

# ---------------------------------------------------------------------------
# Technical indicators
# ---------------------------------------------------------------------------

def calc_ma(close: pd.Series, periods: list[int]) -> dict[str, pd.Series]:
    """Compute simple moving averages."""
    return {f"MA{p}": close.rolling(window=p).mean() for p in periods}


def calc_macd(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9):
    """Return (MACD_line, Signal_line, Histogram)."""
    ema_fast = close.ewm(span=fast, adjust=False).mean()
    ema_slow = close.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


def calc_boll(close: pd.Series, period: int = 20, std: int = 2):
    """Return (Middle, Upper, Lower) Bollinger Bands."""
    middle = close.rolling(window=period).mean()
    std_dev = close.rolling(window=period).std()
    upper = middle + std * std_dev
    lower = middle - std * std_dev
    return middle, upper, lower


def find_pivots(df: pd.DataFrame, window: int = GAN_PIVOT_WINDOW):
    """
    Find significant pivot highs and lows.
    A pivot high is the maximum price in a rolling window centered on that bar.
    """
    highs = df["High"].values
    lows = df["Low"].values
    n = len(df)
    pivot_highs: list[dict] = []  # {index, price, date}
    pivot_lows: list[dict] = []

    for i in range(window, n - window):
        # Pivot high: current high > all highs in window
        if highs[i] == max(highs[i - window : i + window + 1]):
            # Avoid duplicates at same price level
            if not pivot_highs or abs(highs[i] - pivot_highs[-1]["price"]) / pivot_highs[-1]["price"] > 0.005:
                pivot_highs.append({
                    "idx": i,
                    "price": float(highs[i]),
                    "date": df["Date"].iloc[i].strftime("%Y-%m-%d"),
                })
        # Pivot low: current low < all lows in window
        if lows[i] == min(lows[i - window : i + window + 1]):
            if not pivot_lows or abs(lows[i] - pivot_lows[-1]["price"]) / pivot_lows[-1]["price"] > 0.005:
                pivot_lows.append({
                    "idx": i,
                    "price": float(lows[i]),
                    "date": df["Date"].iloc[i].strftime("%Y-%m-%d"),
                })

    return pivot_highs, pivot_lows


def calc_adr(df: pd.DataFrame, period: int = 20) -> float:
    """Average Daily Range over a period."""
    recent = df.tail(period)
    ranges = recent["High"] - recent["Low"]
    return float(ranges.mean())


def calc_gann_fans(df: pd.DataFrame, current_price: float) -> dict:
    """
    Compute Gann Fan support/resistance levels from significant pivots.

    Methodology:
      1. Find pivot highs and lows in the last 60 trading days.
      2. Use the Average Daily Range (ADR) as the 1x1 slope (price unit per day).
      3. From each significant pivot:
         - 1x1 line at day d: pivot_price ± ADR × days_elapsed
         - 1x2 line:           pivot_price ± 2 × ADR × days_elapsed
         - 2x1 line:           pivot_price ± 0.5 × ADR × days_elapsed
      4. Flag any line that is within ±2% of the current price as an active
         support (from pivot low) or resistance (from pivot high).

    Returns a dict with support_levels, resistance_levels, and active_flags.
    """
    if len(df) < 30:
        return {"support_levels": [], "resistance_levels": [], "active_support": None, "active_resistance": None}

    adr = calc_adr(df)
    if adr <= 0:
        return {"support_levels": [], "resistance_levels": [], "active_support": None, "active_resistance": None}

    # Find pivots only in the last 60 bars to keep them relevant
    recent = df.tail(60).reset_index(drop=True)
    pivot_highs, pivot_lows = find_pivots(recent)
    last_idx = len(recent) - 1

    support_levels: list[dict] = []
    resistance_levels: list[dict] = []

    # From pivot lows → upward Gann lines (support)
    for pl in pivot_lows:
        days = last_idx - pl["idx"]
        if days <= 0:
            continue
        levels = {
            "pivot_date": pl["date"],
            "pivot_price": round(pl["price"], 2),
            "days_ago": days,
            "1x1": round(pl["price"] + adr * days, 2),
            "1x2": round(pl["price"] + 2 * adr * days, 2),
            "2x1": round(pl["price"] + 0.5 * adr * days, 2),
        }
        support_levels.append(levels)

    # From pivot highs → downward Gann lines (resistance)
    for ph in pivot_highs:
        days = last_idx - ph["idx"]
        if days <= 0:
            continue
        levels = {
            "pivot_date": ph["date"],
            "pivot_price": round(ph["price"], 2),
            "days_ago": days,
            "1x1": round(ph["price"] - adr * days, 2),
            "1x2": round(ph["price"] - 2 * adr * days, 2),
            "2x1": round(ph["price"] - 0.5 * adr * days, 2),
        }
        resistance_levels.append(levels)

    # Determine if current price is near any Gann line
    def _nearest(levels: list[dict], key: str) -> Optional[dict]:
        best = None
        best_dist = float("inf")
        for lv in levels:
            for line_name in ("1x1", "1x2", "2x1"):
                dist_pct = abs(current_price - lv[line_name]) / current_price
                if dist_pct < SUPPORT_RESISTANCE_PCT and dist_pct < best_dist:
                    best_dist = dist_pct
                    best = {
                        "line": line_name,
                        "price": lv[line_name],
                        "pivot_date": lv["pivot_date"],
                        "pivot_price": lv["pivot_price"],
                        "distance_pct": round(dist_pct * 100, 2),
                    }
        return best

    active_support = _nearest(support_levels, "1x1")
    active_resistance = _nearest(resistance_levels, "1x1")

    return {
        "adr": round(adr, 2),
        "support_levels": support_levels[-3:],       # keep last 3 for brevity
        "resistance_levels": resistance_levels[-3:],
        "active_support": active_support,
        "active_resistance": active_resistance,
    }


def compute_technical_signals(df: pd.DataFrame, current_price: float) -> dict:
    """Run all technical indicators and return a structured signal dict."""
    close = df["Close"]
    latest_close = float(close.iloc[-1])
    prev_close = float(close.iloc[-2]) if len(close) > 1 else latest_close
    change_pct = round((latest_close - prev_close) / prev_close * 100, 2)

    # MA
    mas = calc_ma(close, [5, 10, 20, 50])
    ma_values = {k: round(float(v.iloc[-1]), 2) for k, v in mas.items()}

    # MACD
    macd_line, signal_line, histogram = calc_macd(close)
    macd_val = round(float(macd_line.iloc[-1]), 4)
    signal_val = round(float(signal_line.iloc[-1]), 4)
    hist_val = round(float(histogram.iloc[-1]), 4)
    hist_prev = round(float(histogram.iloc[-2]), 4) if len(histogram) > 1 else 0

    # BOLL
    boll_mid, boll_up, boll_low = calc_boll(close)
    boll_upper = round(float(boll_up.iloc[-1]), 2)
    boll_lower = round(float(boll_low.iloc[-1]), 2)
    boll_middle = round(float(boll_mid.iloc[-1]), 2)

    # Gann Fans
    gann = calc_gann_fans(df, latest_close)

    # ------------------------------------------------------------------
    # Generate human-readable technical signal string
    # ------------------------------------------------------------------
    signals: list[str] = []

    # MA alignment
    if ma_values["MA5"] > ma_values["MA10"] > ma_values["MA20"]:
        signals.append("均线多头排列")
    elif ma_values["MA5"] < ma_values["MA10"] < ma_values["MA20"]:
        signals.append("均线空头排列")
    else:
        signals.append("均线交织")

    # MACD
    if hist_val > 0 and hist_prev <= 0:
        signals.append("MACD金叉")
    elif hist_val < 0 and hist_prev >= 0:
        signals.append("MACD死叉")
    elif hist_val > hist_prev:
        signals.append("MACD柱放大 · 动能增强")
    else:
        signals.append("MACD柱缩小 · 动能减弱")

    # BOLL position
    boll_pos = (latest_close - boll_lower) / (boll_upper - boll_lower) if boll_upper != boll_lower else 0.5
    if boll_pos > 0.95:
        signals.append("触及布林上轨 · 超买")
    elif boll_pos < 0.05:
        signals.append("触及布林下轨 · 超卖")
    elif boll_pos > 0.7:
        signals.append("布林偏强区域")
    elif boll_pos < 0.3:
        signals.append("布林偏弱区域")

    # Gann
    if gann.get("active_support"):
        s = gann["active_support"]
        signals.append(f"Gann{s['line']}支撑@{s['price']}")
    if gann.get("active_resistance"):
        r = gann["active_resistance"]
        signals.append(f"Gann{r['line']}压力@{r['price']}")

    # ------------------------------------------------------------------
    # Generate recommendation
    # ------------------------------------------------------------------
    score = 0
    if "多头排列" in signals[0]: score += 2
    elif "空头排列" in signals[0]: score -= 2
    if "金叉" in signals[1]: score += 2
    elif "死叉" in signals[1]: score -= 2
    if "超卖" in " ".join(signals): score += 1
    if "超买" in " ".join(signals): score -= 1
    if gann.get("active_support"): score += 1
    if gann.get("active_resistance"): score -= 1

    if score >= 3:
        recommendation = "积极看多"
    elif score >= 1:
        recommendation = "持有待涨"
    elif score >= -1:
        recommendation = "观望为主"
    elif score >= -3:
        recommendation = "减仓回避"
    else:
        recommendation = "果断离场"

    return {
        "price": latest_close,
        "changePercent": change_pct,
        "ma": ma_values,
        "macd": {"macd": macd_val, "signal": signal_val, "histogram": hist_val},
        "boll": {"upper": boll_upper, "middle": boll_middle, "lower": boll_lower},
        "gann": gann,
        "technicalSignal": " · ".join(signals),
        "recommendation": recommendation,
    }

# ---------------------------------------------------------------------------
# AI sentiment slot (strictly structured for anti-hallucination)
# ---------------------------------------------------------------------------

def make_empty_ai_slot(code: str, name: str) -> dict:
    """
    Return an empty AI-sentiment slot conforming to the strict schema.

    CRITICAL RULES (enforced by frontend):
      1. Every news item MUST have: publishDate, title, directUrl.
      2. directUrl MUST point to the specific article page (NOT a homepage).
      3. If publishDate or directUrl is missing, the item MUST be flagged
         as "待人工核验" by the frontend.
    """
    return {
        "code": code,
        "name": name,
        "sentiment": "neutral",               # bullish | bearish | neutral
        "sentimentScore": 0.0,                # -1.0 ~ +1.0
        "confidence": 0.0,
        "summary": "",
        "analyzedAt": None,                   # ISO8601 timestamp or null
        "model": None,                        # e.g. "ollama:qwen3" or null
        "news": [],                           # list of validated NewsItem
    }


# Schema for a single validated news item (mirrors frontend type)
# {
#   "id": "unique-id",
#   "title": "文章标题 (必填)",
#   "source": "来源媒体",
#   "publishDate": "2026-05-31",             # REQUIRED – YYYY-MM-DD format
#   "directUrl": "https://.../article/123",   # REQUIRED – direct article link
#   "sentiment": "positive|negative|neutral",
#   "summary": "摘要",
#   "verificationStatus": "verified" | "待人工核验",
# }

# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def run() -> None:
    print("=" * 60)
    print(f"Financial Data Pipeline — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # ---- 1. Fetch indices ----
    print("\n[1/3] Fetching market indices ...")
    indices = []
    for cfg in INDEX_CONFIG:
        print(f"  {cfg['name']} ({cfg['code']}) ...", end=" ")
        df = fetch_price_data(cfg["ak"], cfg["yf"])
        if df is None or df.empty:
            print("FAILED — using placeholder")
            indices.append({
                "code": cfg["code"],
                "name": cfg["name"],
                "price": 0,
                "change": 0,
                "changePercent": 0,
                "_stale": True,
            })
            continue
        close = df["Close"]
        latest = float(close.iloc[-1])
        prev = float(close.iloc[-2]) if len(close) > 1 else latest
        change = round(latest - prev, 2)
        change_pct = round((latest - prev) / prev * 100, 2)
        indices.append({
            "code": cfg["code"],
            "name": cfg["name"],
            "price": latest,
            "change": change,
            "changePercent": change_pct,
            "_stale": False,
        })
        print(f"{latest:.2f} ({change_pct:+.2f}%)")

    # ---- 2. Fetch holdings & compute technicals ----
    print("\n[2/3] Fetching holdings & computing technicals ...")
    holdings = []
    for cfg in HOLDING_CONFIG:
        print(f"  {cfg['name']} ({cfg['code']}) ...", end=" ")
        df = fetch_price_data(cfg["ak"], cfg["yf"])
        if df is None or df.empty:
            print("FAILED — using placeholder")
            holdings.append({
                "code": cfg["code"],
                "name": cfg["name"],
                "price": 0,
                "changePercent": 0,
                "technicalSignal": "数据暂不可用",
                "recommendation": "待更新",
                # AI slot
                "aiSentiment": make_empty_ai_slot(cfg["code"], cfg["name"]),
            })
            continue

        signals = compute_technical_signals(df, float(df["Close"].iloc[-1]))
        print(f"{signals['price']:.2f} ({signals['changePercent']:+.2f}%) — {signals['recommendation']}")

        holdings.append({
            "code": cfg["code"],
            "name": cfg["name"],
            "price": signals["price"],
            "changePercent": signals["changePercent"],
            "technicalSignal": signals["technicalSignal"],
            "recommendation": signals["recommendation"],
            "indicators": {
                "ma": signals["ma"],
                "macd": signals["macd"],
                "boll": signals["boll"],
                "gann": signals["gann"],
            },
            # AI sentiment slot — to be filled by external LLM pipeline
            "aiSentiment": make_empty_ai_slot(cfg["code"], cfg["name"]),
        })

    # ---- 3. Assemble & write ----
    print("\n[3/3] Writing output ...")
    output = {
        "generatedAt": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "generatedBy": "scripts/update_data.py",
        "indices": indices,
        "holdings": holdings,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"  Written to {OUTPUT_PATH}")
    print(f"  File size: {OUTPUT_PATH.stat().st_size:,} bytes")
    print("\nDone.\n")


if __name__ == "__main__":
    run()
