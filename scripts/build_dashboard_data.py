from __future__ import annotations
import csv, json, math, re, html
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'data'; DOCS=ROOT/'docs'
WEATHER_CODES_URL='https://www.smhi.se/data/hitta-data-for-en-plats/ladda-ner-vaderobservationer/presentWeather'
PARAMS={1:'Lufttemperatur',3:'Vindriktning',4:'Vindhastighet',5:'Nederbörd 1 dygn',13:'Rådande väder'}

def read_param(pid:int):
    rows=[]; folder=DATA/f'parameter_{pid}'
    if not folder.exists(): return rows
    for path in sorted(folder.glob('*.csv')):
        with path.open('r',encoding='utf-8-sig',newline='') as f:
            for r in csv.DictReader(f):
                dt=r.get('datetime_local') or r.get('datetime_utc') or ''
                try: d=datetime.fromisoformat(dt.replace('Z','+00:00'))
                except Exception: continue
                val=r.get('value_numeric')
                if val in (None,''): val=r.get('value')
                try: num=float(str(val).replace(',','.'))
                except Exception: continue
                rows.append((d,num))
    return rows

def mean(vals): return sum(vals)/len(vals) if vals else None
def r2(x): return None if x is None else round(x,2)

def aggregate_mean(rows):
    y=defaultdict(list); ym=defaultdict(list)
    for d,v in rows: y[d.year].append(v); ym[(d.year,d.month)].append(v)
    return ([{'year':k,'avg':r2(mean(v))} for k,v in sorted(y.items())],
            [{'year':k[0],'month':k[1],'avg':r2(mean(v))} for k,v in sorted(ym.items())])

def circular_mean_deg(vals):
    vals=[v for v in vals if v!=0]  # 0 kan betyda vindstilla enligt SMHI
    if not vals: return None
    s=sum(math.sin(math.radians(v)) for v in vals)
    c=sum(math.cos(math.radians(v)) for v in vals)
    if abs(s)<1e-12 and abs(c)<1e-12: return None
    d=math.degrees(math.atan2(s,c))%360
    return 360.0 if abs(d)<1e-9 else d

def aggregate_direction(rows):
    y=defaultdict(list)
    for d,v in rows: y[d.year].append(v)
    return [{'year':yr,'avg':r2(circular_mean_deg(vals))} for yr,vals in sorted(y.items()) if circular_mean_deg(vals) is not None]

def aggregate_daily_max_annual(rows):
    daily=defaultdict(list)
    for d,v in rows: daily[d.date()].append(v)
    yearly=defaultdict(list)
    for day,vals in daily.items(): yearly[day.year].append(max(vals))
    return [{'year':yr,'max':r2(max(vals))} for yr,vals in sorted(yearly.items()) if vals]

def aggregate_precip(rows):
    y=defaultdict(float); ym=defaultdict(list)
    for d,v in rows: y[d.year]+=v; ym[(d.year,d.month)].append(v)
    return ([{'year':k,'sum':r2(v)} for k,v in sorted(y.items())],
            [{'year':k[0],'month':k[1],'avg':r2(mean(v))} for k,v in sorted(ym.items())])

def aggregate_weather(rows):
    c=defaultdict(int)
    for d,v in rows:
        code=str(int(v)) if float(v).is_integer() else str(v)
        c[(d.year,d.month,code)]+=1
    return [{'year':k[0],'month':k[1],'code':k[2],'count':v} for k,v in sorted(c.items())]

def fetch_weather_labels():
    labels={}
    try:
        req=Request(WEATHER_CODES_URL,headers={'User-Agent':'SMHI-Kallax-vaderdata GitHub Action'})
        raw=urlopen(req,timeout=30).read().decode('utf-8','ignore')
        # SMHI:s sida innehåller kodtabellen i HTML. Matcha två intilliggande tabellceller.
        for code,label in re.findall(r'<td[^>]*>\s*(\d{1,3})\s*</td>\s*<td[^>]*>(.*?)</td>',raw,re.I|re.S):
            clean=re.sub(r'<[^>]+>',' ',label)
            clean=html.unescape(re.sub(r'\s+',' ',clean)).strip()
            if clean: labels[code]=clean
    except Exception as e:
        print(f'Warning: could not fetch SMHI weather code labels: {e}')
    return labels

def coverage(rows,name):
    if not rows:return {'name':name,'min_date':'-','max_date':'-','rows':0}
    dates=[d for d,_ in rows]
    return {'name':name,'min_date':min(dates).date().isoformat(),'max_date':max(dates).date().isoformat(),'rows':len(rows)}

temp=read_param(1); wind_dir=read_param(3); wind_speed=read_param(4); prec=read_param(5); weather=read_param(13)
temp_a,temp_m=aggregate_mean(temp); wind_s_a,_=aggregate_mean(wind_speed); prec_a,prec_m=aggregate_precip(prec)
weather_rows=aggregate_weather(weather)
used_codes=sorted({r['code'] for r in weather_rows},key=lambda x:float(x))
all_labels=fetch_weather_labels()
labels={c:all_labels.get(c,f'Kod {c}') for c in used_codes}
all_years=sorted({d.year for rows in [temp,wind_dir,wind_speed,prec,weather] for d,_ in rows})

payload={
 'generated_at':datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC'),
 'station':{'id':'162860','name':'Luleå-Kallax Flygplats'},'years':all_years,
 'temperature':{'annual':temp_a,'monthly':temp_m},
 'precipitation':{'annual':prec_a,'monthly_daily_avg':prec_m},
 'weather':{'codes':weather_rows,'labels':labels,'source_url':WEATHER_CODES_URL},
 'wind':{'speed_annual':wind_s_a,'daily_max_annual':aggregate_daily_max_annual(wind_speed),'direction_annual':aggregate_direction(wind_dir)},
 'coverage':[coverage(temp,PARAMS[1]),coverage(prec,PARAMS[5]),coverage(weather,PARAMS[13]),coverage(wind_speed,PARAMS[4]),coverage(wind_dir,PARAMS[3])]
}
DOCS.mkdir(exist_ok=True)
(DOCS/'dashboard_data.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(f"Wrote {DOCS/'dashboard_data.json'} with {len(labels)} weather code labels")
