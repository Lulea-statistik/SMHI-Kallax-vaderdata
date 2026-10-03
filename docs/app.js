let DATA=null;const charts={};const months=['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];
const el=id=>document.getElementById(id);
function destroyChart(id){if(charts[id]){charts[id].destroy();delete charts[id];}}
function lineChart(id,labels,datasets,yTitle,extra={}){destroyChart(id);charts[id]=new Chart(el(id),{type:'line',data:{labels,datasets:datasets.map(d=>({borderWidth:2,pointRadius:0,tension:.15,...d}))},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:datasets.length>1}},scales:{x:{grid:{display:false}},y:{title:{display:!!yTitle,text:yTitle}}},...extra}});}
function barChart(id,labels,data,yTitle,tooltipCb=null){destroyChart(id);charts[id]=new Chart(el(id),{type:'bar',data:{labels,datasets:[{data,borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:tooltipCb?{callbacks:tooltipCb}:{}},scales:{x:{grid:{display:false}},y:{beginAtZero:true,title:{display:!!yTitle,text:yTitle}}}}});}
function currentFilters(){return{from:+el('yearFrom').value,to:+el('yearTo').value,month:+el('month').value};}
function inYears(r,f){return r.year>=f.from&&r.year<=f.to;}
function directionName(deg){const names=['N','NO','O','SO','S','SV','V','NV'];return names[Math.round((((deg||0)%360)+360)%360/45)%8];}
function updateCompass(deg,label=''){if(deg==null||Number.isNaN(+deg))return;const d=((+deg%360)+360)%360;el('windArrow').style.transform='translate(-50%,-100%) rotate('+d+'deg)';el('windCompassText').textContent=(label?label+' · ':'')+d.toFixed(0)+'° = vind från '+directionName(d);}
function circularFromParts(rows){let s=0,c=0,n=0;rows.forEach(r=>{s+=r.sin_sum||0;c+=r.cos_sum||0;n+=r.count||0;});if(!n||(!s&&!c))return null;let d=Math.atan2(s,c)*180/Math.PI;d=(d+360)%360;return d===0?360:d;}
function temperatureMetric(){return el('tempMetric').value;}
function metricName(m){return m==='min'?'Minimum':m==='max'?'Maximum':'Genomsnittlig';}

function weatherChart(rows){
  destroyChart('weatherCodes');
  const code=el('weatherCode').value;
  const years=[...new Set(rows.map(r=>r.year))].sort((a,b)=>a-b);
  const totals={};rows.forEach(r=>totals[r.year]=(totals[r.year]||0)+r.count);
  const vals=years.map(y=>{const n=rows.filter(r=>r.year===y&&String(r.code)===code).reduce((s,r)=>s+r.count,0);return totals[y]?100*n/totals[y]:0;});
  charts.weatherCodes=new Chart(el('weatherCodes'),{type:'bar',data:{labels:years,datasets:[{data:vals,borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{displayColors:false,callbacks:{title:items=>String(items[0].label),label:c=>c.parsed.y.toFixed(1)+' %'}}},scales:{x:{grid:{display:false}},y:{beginAtZero:true,max:100,title:{display:true,text:'Andel observationer (%)'},ticks:{callback:v=>v+' %'}}}}});
  el('weatherTitle').textContent=(DATA.weather.labels[code]||('Kod '+code))+' – andel observationer per år';
}

function render(){
  const f=currentFilters(),m=temperatureMetric(),name=metricName(m);
  const ta=DATA.temperature.annual.filter(r=>inYears(r,f));lineChart('tempAnnual',ta.map(r=>r.year),[{label:'°C',data:ta.map(r=>r[m])}],'°C');
  el('tempAnnualTitle').textContent=name+' lufttemperatur per år';
  let tm=DATA.temperature.monthly.filter(r=>inYears(r,f));if(f.month)tm=tm.filter(r=>r.month===f.month);
  const tMonthAgg=[...Array(12)].map((_,i)=>{const rows=tm.filter(r=>r.month===i+1);if(!rows.length)return null;return m==='min'?Math.min(...rows.map(r=>r.min)):m==='max'?Math.max(...rows.map(r=>r.max)):rows.reduce((s,r)=>s+r.avg,0)/rows.length;});
  lineChart('tempMonthly',months,[{label:'°C',data:tMonthAgg}],'°C');el('tempMonthlyTitle').textContent=name+' lufttemperatur per månad';

  const years=[...new Set(DATA.temperature.monthly.filter(r=>inYears(r,f)).map(r=>r.year))].sort((a,b)=>a-b).slice(-10);
  lineChart('tempProfiles',months,years.map(y=>({label:String(y),data:[...Array(12)].map((_,i)=>{const r=DATA.temperature.monthly.find(x=>x.year===y&&x.month===i+1);return r?r.avg:null;})})),'°C');

  const pa=DATA.precipitation.annual.filter(r=>inYears(r,f));barChart('precipAnnual',pa.map(r=>r.year),pa.map(r=>r.sum),'mm');
  let pm=DATA.precipitation.monthly_daily_avg.filter(r=>inYears(r,f));if(f.month)pm=pm.filter(r=>r.month===f.month);
  const pMonthAgg=[...Array(12)].map((_,i)=>{const rows=pm.filter(r=>r.month===i+1);return rows.length?rows.reduce((s,r)=>s+r.avg,0)/rows.length:null;});lineChart('precipMonthly',months,[{label:'mm',data:pMonthAgg}],'mm/dygn');

  let wc=DATA.weather.codes.filter(r=>inYears(r,f));if(f.month)wc=wc.filter(r=>r.month===f.month);weatherChart(wc);

  const ws=DATA.wind.speed_annual.filter(r=>inYears(r,f)),wm=DATA.wind.daily_max_annual.filter(r=>inYears(r,f));
  lineChart('windSpeed',ws.map(r=>r.year),[{label:'Årsmedel',data:ws.map(r=>r.avg)},{label:'Högsta dygnsmax',data:ws.map(r=>{const x=wm.find(a=>a.year===r.year);return x?x.max:null;})}],'m/s');

  const wd=DATA.wind.direction_annual.filter(r=>inYears(r,f));destroyChart('windDirection');
  charts.windDirection=new Chart(el('windDirection'),{type:'line',data:{labels:wd.map(r=>r.year),datasets:[{data:wd.map(r=>r.avg),borderWidth:2,pointRadius:2,tension:.1}]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'nearest',intersect:false},onHover:(e,pts)=>{if(pts.length){const i=pts[0].index;updateCompass(wd[i].avg,String(wd[i].year));}},plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.parsed.y.toFixed(0)+'° ('+directionName(c.parsed.y)+')'}}},scales:{x:{grid:{display:false}},y:{min:0,max:360,title:{display:true,text:'grader'},ticks:{stepSize:45,callback:v=>v+'° '+directionName(v)}}}}});

  const wdm=DATA.wind.direction_monthly.filter(r=>inYears(r,f));
  const monthly=[...Array(12)].map((_,i)=>circularFromParts(wdm.filter(r=>r.month===i+1)));
  destroyChart('windDirectionMonthly');
  charts.windDirectionMonthly=new Chart(el('windDirectionMonthly'),{type:'line',data:{labels:months,datasets:[{data:monthly,borderWidth:2,pointRadius:2,tension:.1}]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'nearest',intersect:false},onHover:(e,pts)=>{if(pts.length){const i=pts[0].index;updateCompass(monthly[i],months[i]);}},plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.parsed.y.toFixed(0)+'° ('+directionName(c.parsed.y)+')'}}},scales:{x:{grid:{display:false}},y:{min:0,max:360,title:{display:true,text:'grader'},ticks:{stepSize:45,callback:v=>v+'° '+directionName(v)}}}}});
  if(monthly.filter(x=>x!=null).length){const i=monthly.map(x=>x!=null).lastIndexOf(true);updateCompass(monthly[i],months[i]);}

  el('coverage').innerHTML='<table><thead><tr><th>Parameter</th><th>Från</th><th>Till</th><th>Observationer</th></tr></thead><tbody>'+DATA.coverage.map(r=>'<tr><td>'+r.name+'</td><td>'+r.min_date+'</td><td>'+r.max_date+'</td><td>'+r.rows.toLocaleString('sv-SE')+'</td></tr>').join('')+'</tbody></table>';
}
function syncYear(source,value){
  let a=+el('yearFrom').value,b=+el('yearTo').value;
  if(source==='from')a=+value;else b=+value;if(a>b){if(source==='from')b=a;else a=b;}
  el('yearFrom').value=a;el('yearTo').value=b;el('rangeFrom').value=a;el('rangeTo').value=b;el('rangeFromLabel').textContent=a;el('rangeToLabel').textContent=b;render();
}
function setupTabs(){document.querySelectorAll('#tabs button').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('#tabs button').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));btn.classList.add('active');el('page-'+btn.dataset.page).classList.add('active');setTimeout(()=>Object.values(charts).forEach(c=>c.resize()),50);}));}
function setupFilters(){
  const years=DATA.years,min=years[0],max=years[years.length-1];['yearFrom','yearTo'].forEach(id=>el(id).innerHTML=years.map(y=>'<option value="'+y+'">'+y+'</option>').join(''));
  el('yearFrom').value=min;el('yearTo').value=max;['rangeFrom','rangeTo'].forEach(id=>{el(id).min=min;el(id).max=max;el(id).step=1;});el('rangeFrom').value=min;el('rangeTo').value=max;el('rangeFromLabel').textContent=min;el('rangeToLabel').textContent=max;
  el('yearFrom').addEventListener('change',e=>syncYear('from',e.target.value));el('yearTo').addEventListener('change',e=>syncYear('to',e.target.value));el('rangeFrom').addEventListener('input',e=>syncYear('from',e.target.value));el('rangeTo').addEventListener('input',e=>syncYear('to',e.target.value));
  el('month').addEventListener('change',render);el('tempMetric').addEventListener('change',render);el('weatherCode').addEventListener('change',render);
  el('resetFilters').addEventListener('click',()=>{syncYear('from',min);syncYear('to',max);el('month').value='0';render();});
}
function setupWeatherCodes(){
  const codes=[...new Set(DATA.weather.codes.map(r=>String(r.code)))].sort((a,b)=>Number(a)-Number(b));el('weatherCode').innerHTML=codes.map(c=>'<option value="'+c+'">'+c+' – '+(DATA.weather.labels[c]||('Kod '+c))+'</option>').join('');
  if(codes.includes('100'))el('weatherCode').value='100';
}
fetch('dashboard_data.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('dashboard_data.json saknas');return r.json();}).then(d=>{DATA=d;el('updated').textContent='Data uppdaterad: '+(d.generated_at||'okänt');el('weatherSource').href=d.weather.source_url;setupWeatherCodes();setupTabs();setupFilters();render();}).catch(err=>{document.querySelector('main').innerHTML='<div class="chart-card"><h2>Rapportdata saknas</h2><p>'+err.message+'</p></div>';});