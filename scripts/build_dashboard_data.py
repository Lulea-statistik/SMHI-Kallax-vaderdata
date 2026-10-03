from __future__ import annotations
import csv,json,math,re,html
from collections import defaultdict
from datetime import datetime,timezone
from pathlib import Path
from urllib.request import Request,urlopen
ROOT=Path(__file__).resolve().parents[1];DATA=ROOT/'data';DOCS=ROOT/'docs'
WEATHER_CODES_URL='https://www.smhi.se/data/hitta-data-for-en-plats/ladda-ner-vaderobservationer/presentWeather'
PARAMS={1:'Lufttemperatur',3:'Vindriktning',4:'Vindhastighet',5:'Nederbörd 1 dygn',6:'Relativ luftfuktighet',8:'Snödjup',10:'Solskenstid',12:'Sikt',13:'Rådande väder',21:'Byvind'}

def read_param(pid:int):
    rows=[];folder=DATA/f'parameter_{pid}'
    if not folder.exists():return rows
    for path in sorted(folder.glob('*.csv')):
        with path.open('r',encoding='utf-8-sig',newline='') as f:
            for r in csv.DictReader(f):
                dt=r.get('datetime_local') or r.get('datetime_utc') or ''
                try:d=datetime.fromisoformat(dt.replace('Z','+00:00'))
                except Exception:continue
                val=r.get('value_numeric')
                if val in (None,''):val=r.get('value')
                try:num=float(str(val).replace(',','.'))
                except Exception:continue
                rows.append((d,num))
    return rows

def mean(v):return sum(v)/len(v) if v else None
def r2(x):return None if x is None else round(x,2)
def aggregate_temp(rows):
    y=defaultdict(list);ym=defaultdict(list)
    for d,v in rows:y[d.year].append(v);ym[(d.year,d.month)].append(v)
    def rec(k,vals,monthly=False):
        out={'avg':r2(mean(vals)),'min':r2(min(vals)),'max':r2(max(vals))}
        if monthly:out.update(year=k[0],month=k[1])
        else:out.update(year=k)
        return out
    return [rec(k,v) for k,v in sorted(y.items())],[rec(k,v,True) for k,v in sorted(ym.items())]
def aggregate_mean(rows):
    y=defaultdict(list);ym=defaultdict(list)
    for d,v in rows:y[d.year].append(v);ym[(d.year,d.month)].append(v)
    return ([{'year':k,'avg':r2(mean(v))} for k,v in sorted(y.items())],[{'year':k[0],'month':k[1],'avg':r2(mean(v))} for k,v in sorted(ym.items())])
def direction_parts(vals):
    vals=[v for v in vals if v!=0]
    if not vals:return None
    s=sum(math.sin(math.radians(v)) for v in vals);c=sum(math.cos(math.radians(v)) for v in vals)
    if abs(s)<1e-12 and abs(c)<1e-12:return None
    d=math.degrees(math.atan2(s,c))%360
    if abs(d)<1e-9:d=360.0
    return {'avg':r2(d),'sin_sum':s,'cos_sum':c,'count':len(vals)}
def aggregate_direction(rows):
    y=defaultdict(list);ym=defaultdict(list)
    for d,v in rows:y[d.year].append(v);ym[(d.year,d.month)].append(v)
    annual=[];monthly=[]
    for yr,vals in sorted(y.items()):
        p=direction_parts(vals)
        if p:annual.append({'year':yr,**p})
    for k,vals in sorted(ym.items()):
        p=direction_parts(vals)
        if p:monthly.append({'year':k[0],'month':k[1],**p})
    return annual,monthly
def aggregate_daily_max_annual(rows):
    daily=defaultdict(list)
    for d,v in rows:daily[d.date()].append(v)
    yearly=defaultdict(list)
    for day,vals in daily.items():yearly[day.year].append(max(vals))
    return [{'year':yr,'max':r2(max(vals))} for yr,vals in sorted(yearly.items()) if vals]
def aggregate_precip(rows):
    y=defaultdict(float);ym=defaultdict(float)
    for d,v in rows:y[d.year]+=v;ym[(d.year,d.month)]+=v
    return ([{'year':k,'sum':r2(v)} for k,v in sorted(y.items())],[{'year':k[0],'month':k[1],'sum':r2(v)} for k,v in sorted(ym.items())])
def aggregate_max(rows):
    y=defaultdict(list);ym=defaultdict(list)
    for d,v in rows:y[d.year].append(v);ym[(d.year,d.month)].append(v)
    return ([{'year':k,'max':r2(max(v))} for k,v in sorted(y.items()) if v],[{'year':k[0],'month':k[1],'max':r2(max(v))} for k,v in sorted(ym.items()) if v])
def aggregate_sum_hours(rows):
    y=defaultdict(float);ym=defaultdict(float)
    for d,v in rows:y[d.year]+=v;ym[(d.year,d.month)]+=v
    return ([{'year':k,'hours':r2(v/3600.0)} for k,v in sorted(y.items())],[{'year':k[0],'month':k[1],'hours':r2(v/3600.0)} for k,v in sorted(ym.items())])
def aggregate_weather(rows):
    c=defaultdict(int)
    for d,v in rows:
        code=str(int(v)) if float(v).is_integer() else str(v);c[(d.year,d.month,code)]+=1
    return [{'year':k[0],'month':k[1],'code':k[2],'count':v} for k,v in sorted(c.items())]
def zero_crossings(rows):
    byday=defaultdict(list)
    for d,v in rows:byday[d.date()].append((d,v))
    out=[]
    for day,obs in sorted(byday.items()):
        obs.sort(key=lambda x:x[0]);last_sign=None;cross=0;dirs=[]
        vals=[v for _,v in obs]
        for _,v in obs:
            sign=1 if v>0 else -1 if v<0 else 0
            if sign==0:continue
            if last_sign is not None and sign!=last_sign:
                cross+=1;dirs.append('-→+' if last_sign<0 else '+→-')
            last_sign=sign
        if cross:
            out.append({'date':day.isoformat(),'year':day.year,'month':day.month,'min':r2(min(vals)),'max':r2(max(vals)),'crossings':cross,'directions':dirs,'observations':len(obs)})
    return out
def fetch_weather_labels():
    labels={}
    try:
        req=Request(WEATHER_CODES_URL,headers={'User-Agent':'SMHI-Kallax-vaderdata GitHub Action'});raw=urlopen(req,timeout=30).read().decode('utf-8','ignore')
        patterns=[r'<td[^>]*>\s*(\d{1,3})\s*</td>\s*<td[^>]*>(.*?)</td>',r'["\']?(\d{1,3})["\']?\s*[:=,]\s*["\']([^"\']{3,180})["\']',r'Kod\s*(\d{1,3})\s*</[^>]+>\s*<[^>]+>([^<]{3,180})']
        for pat in patterns:
            for code,label in re.findall(pat,raw,re.I|re.S):
                clean=html.unescape(re.sub(r'<[^>]+>',' ',label));clean=re.sub(r'\s+',' ',clean).strip()
                if clean and not clean.lower().startswith('kod '):labels.setdefault(code,clean)
    except Exception as e:print(f'Warning: could not fetch SMHI weather code labels: {e}')
    return labels
def coverage(rows,name):
    if not rows:return {'name':name,'min_date':'-','max_date':'-','rows':0}
    dates=[d for d,_ in rows];return {'name':name,'min_date':min(dates).date().isoformat(),'max_date':max(dates).date().isoformat(),'rows':len(rows)}

temp=read_param(1);wind_dir=read_param(3);wind_speed=read_param(4);prec=read_param(5);humidity=read_param(6);snow=read_param(8);sunshine=read_param(10);visibility=read_param(12);weather=read_param(13);gust=read_param(21)
temp_a,temp_m=aggregate_temp(temp);wind_s_a,_=aggregate_mean(wind_speed);wind_d_a,wind_d_m=aggregate_direction(wind_dir);prec_a,prec_m=aggregate_precip(prec);hum_a,hum_m=aggregate_mean(humidity);vis_a,vis_m=aggregate_mean(visibility);snow_a,snow_m=aggregate_mean(snow);snow_max_a,_=aggregate_max(snow);gust_max_a,_=aggregate_max(gust);sun_a,sun_m=aggregate_sum_hours(sunshine)
weather_rows=aggregate_weather(weather);used=sorted({r['code'] for r in weather_rows},key=lambda x:float(x));all_labels=fetch_weather_labels();labels={c:all_labels.get(c,f'Kod {c}') for c in used}
all_years=sorted({d.year for rows in [temp,wind_dir,wind_speed,prec,humidity,snow,sunshine,visibility,weather,gust] for d,_ in rows})
payload={'generated_at':datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC'),'station':{'id':'162860','name':'Luleå-Kallax Flygplats'},'years':all_years,
 'temperature':{'annual':temp_a,'monthly':temp_m},'precipitation':{'annual':prec_a,'monthly_total':prec_m},
 'weather':{'codes':weather_rows,'labels':labels,'source_url':WEATHER_CODES_URL},
 'wind':{'speed_annual':wind_s_a,'daily_max_annual':aggregate_daily_max_annual(wind_speed),'gust_max_annual':gust_max_a,'direction_annual':wind_d_a,'direction_monthly':wind_d_m},
 'visibility':{'annual':vis_a,'monthly':vis_m},'humidity':{'annual':hum_a,'monthly':hum_m},
 'snow':{'annual_mean':snow_a,'annual_max':snow_max_a,'monthly':snow_m},
 'sunshine':{'station':{'id':'162015','name':'Luleå Sol'},'annual':sun_a,'monthly_total':sun_m},
 'zero_crossings':zero_crossings(temp),
 'coverage':[coverage(temp,PARAMS[1]),coverage(prec,PARAMS[5]),coverage(weather,PARAMS[13]),coverage(wind_speed,PARAMS[4]),coverage(wind_dir,PARAMS[3]),coverage(gust,PARAMS[21]),coverage(visibility,PARAMS[12]),coverage(humidity,PARAMS[6]),coverage(snow,PARAMS[8]),coverage(sunshine,PARAMS[10])]}
DOCS.mkdir(exist_ok=True);(DOCS/'dashboard_data.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')),encoding='utf-8');print(f"Wrote {DOCS/'dashboard_data.json'} with {len(labels)} weather labels and {len(payload['zero_crossings'])} zero-crossing days")
