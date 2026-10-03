from __future__ import annotations
import csv, json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'data'
DOCS=ROOT/'docs'

PARAMS={
    1:'Lufttemperatur',
    3:'Vindriktning',
    4:'Vindhastighet',
    5:'Nederbörd 1 dygn',
    13:'Rådande väder',
}

def read_param(pid:int):
    rows=[]
    folder=DATA/f'parameter_{pid}'
    if not folder.exists():
        return rows
    for path in sorted(folder.glob('*.csv')):
        with path.open('r',encoding='utf-8-sig',newline='') as f:
            for r in csv.DictReader(f):
                dt=r.get('datetime_local') or r.get('datetime_utc') or ''
                try:
                    d=datetime.fromisoformat(dt.replace('Z','+00:00'))
                except Exception:
                    continue
                val=r.get('value_numeric')
                if val in (None,''):
                    val=r.get('value')
                try:
                    num=float(str(val).replace(',','.'))
                except Exception:
                    continue
                rows.append((d,num))
    return rows

def mean(vals):
    return sum(vals)/len(vals) if vals else None

def r2(x):
    return None if x is None else round(x,2)

def aggregate_mean(rows):
    y=defaultdict(list); ym=defaultdict(list)
    for d,v in rows:
        y[d.year].append(v); ym[(d.year,d.month)].append(v)
    annual=[{'year':k,'avg':r2(mean(v))} for k,v in sorted(y.items())]
    monthly=[{'year':k[0],'month':k[1],'avg':r2(mean(v))} for k,v in sorted(ym.items())]
    return annual,monthly

def aggregate_precip(rows):
    y=defaultdict(float); ym=defaultdict(list)
    for d,v in rows:
        y[d.year]+=v; ym[(d.year,d.month)].append(v)
    annual=[{'year':k,'sum':r2(v)} for k,v in sorted(y.items())]
    monthly=[{'year':k[0],'month':k[1],'avg':r2(mean(v))} for k,v in sorted(ym.items())]
    return annual,monthly

def aggregate_weather(rows):
    c=defaultdict(int)
    for d,v in rows:
        code=str(int(v)) if float(v).is_integer() else str(v)
        c[(d.year,d.month,code)]+=1
    return [{'year':k[0],'month':k[1],'code':k[2],'count':v} for k,v in sorted(c.items())]

def coverage(rows,name):
    if not rows:
        return {'name':name,'min_date':'-','max_date':'-','rows':0}
    dates=[d for d,_ in rows]
    return {'name':name,'min_date':min(dates).date().isoformat(),'max_date':max(dates).date().isoformat(),'rows':len(rows)}

temp=read_param(1)
wind_dir=read_param(3)
wind_speed=read_param(4)
prec=read_param(5)
weather=read_param(13)

temp_a,temp_m=aggregate_mean(temp)
wind_d_a,_=aggregate_mean(wind_dir)
wind_s_a,_=aggregate_mean(wind_speed)
prec_a,prec_m=aggregate_precip(prec)

all_years=sorted({d.year for rows in [temp,wind_dir,wind_speed,prec,weather] for d,_ in rows})

payload={
    'generated_at': datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC'),
    'station': {'id':'162860','name':'Luleå-Kallax Flygplats'},
    'years': all_years,
    'temperature': {'annual':temp_a,'monthly':temp_m},
    'precipitation': {'annual':prec_a,'monthly_daily_avg':prec_m},
    'weather': {'codes':aggregate_weather(weather)},
    'wind': {'speed_annual':wind_s_a,'direction_annual':wind_d_a},
    'coverage': [
        coverage(temp,PARAMS[1]),coverage(prec,PARAMS[5]),coverage(weather,PARAMS[13]),
        coverage(wind_speed,PARAMS[4]),coverage(wind_dir,PARAMS[3]),
    ],
}
DOCS.mkdir(exist_ok=True)
(DOCS/'dashboard_data.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(f"Wrote {DOCS/'dashboard_data.json'}")
