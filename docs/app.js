let DATA=null;
const charts={};
const months=['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];

function destroyChart(id){if(charts[id]){charts[id].destroy();delete charts[id];}}
function lineChart(id,labels,datasets,yTitle,extra={}){
  destroyChart(id);
  charts[id]=new Chart(document.getElementById(id),{type:'line',
    data:{labels,datasets:datasets.map(d=>({borderWidth:2,pointRadius:0,tension:.15,...d}))},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:datasets.length>1}},scales:{x:{grid:{display:false}},y:{title:{display:!!yTitle,text:yTitle}}},
      ...extra}});
}
function barChart(id,labels,data,yTitle){
  destroyChart(id); charts[id]=new Chart(document.getElementById(id),{type:'bar',
    data:{labels,datasets:[{data,borderWidth:0}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{x:{grid:{display:false}},y:{beginAtZero:true,title:{display:!!yTitle,text:yTitle}}}}});
}
function currentFilters(){return{from:+yearFrom.value,to:+yearTo.value,month:+month.value};}
function inYears(r,f){return r.year>=f.from&&r.year<=f.to;}
function codeLabel(code){return DATA.weather.labels[String(code)]||('Kod '+code);}
function directionName(deg){
  const names=['N','NO','O','SO','S','SV','V','NV'];
  return names[Math.round(((deg%360)+360)%360/45)%8];
}
function updateCompass(deg,year){
  if(deg==null||Number.isNaN(+deg)) return;
  const d=((+deg%360)+360)%360;
  windArrow.style.transform='translate(-50%,-100%) rotate('+d+'deg)';
  windCompassText.textContent=(year?year+' · ':'')+d.toFixed(0)+'° = vind från '+directionName(d);
}
function weatherChart(rows){
  destroyChart('weatherCodes');
  const years=[...new Set(rows.map(r=>r.year))].sort((a,b)=>a-b);
  const codes=[...new Set(rows.map(r=>String(r.code)))].sort((a,b)=>Number(a)-Number(b));
  const totalByYear={}; rows.forEach(r=>totalByYear[r.year]=(totalByYear[r.year]||0)+r.count);
  const datasets=codes.map(code=>({label:code+' – '+codeLabel(code),
    data:years.map(y=>{const n=rows.filter(r=>r.year===y&&String(r.code)===code).reduce((s,r)=>s+r.count,0);return totalByYear[y]?100*n/totalByYear[y]:0;}),
    borderWidth:0}));
  charts.weatherCodes=new Chart(document.getElementById('weatherCodes'),{type:'bar',data:{labels:years,datasets},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{position:'bottom',labels:{boxWidth:12,font:{size:10}}},
        tooltip:{callbacks:{label:c=>c.dataset.label+': '+c.parsed.y.toFixed(1)+' %'}}},
      scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,min:0,max:100,title:{display:true,text:'Andel observationer (%)'},ticks:{callback:v=>v+' %'}}}}});
}
function render(){
  const f=currentFilters();
  const ta=DATA.temperature.annual.filter(r=>inYears(r,f));
  lineChart('tempAnnual',ta.map(r=>r.year),[{label:'°C',data:ta.map(r=>r.avg)}],'°C');

  let tm=DATA.temperature.monthly.filter(r=>inYears(r,f)); if(f.month)tm=tm.filter(r=>r.month===f.month);
  const tMonthAgg=[...Array(12)].map((_,i)=>{const rows=tm.filter(r=>r.month===i+1);return rows.length?rows.reduce((s,r)=>s+r.avg,0)/rows.length:null;});
  lineChart('tempMonthly',months,[{label:'°C',data:tMonthAgg}],'°C');

  const years=[...new Set(DATA.temperature.monthly.filter(r=>inYears(r,f)).map(r=>r.year))].sort((a,b)=>a-b).slice(-10);
  lineChart('tempProfiles',months,years.map(y=>({label:String(y),data:[...Array(12)].map((_,i)=>{const r=DATA.temperature.monthly.find(x=>x.year===y&&x.month===i+1);return r?r.avg:null;})})),'°C');

  const pa=DATA.precipitation.annual.filter(r=>inYears(r,f)); barChart('precipAnnual',pa.map(r=>r.year),pa.map(r=>r.sum),'mm');
  let pm=DATA.precipitation.monthly_daily_avg.filter(r=>inYears(r,f));if(f.month)pm=pm.filter(r=>r.month===f.month);
  const pMonthAgg=[...Array(12)].map((_,i)=>{const rows=pm.filter(r=>r.month===i+1);return rows.length?rows.reduce((s,r)=>s+r.avg,0)/rows.length:null;});
  lineChart('precipMonthly',months,[{label:'mm',data:pMonthAgg}],'mm/dygn');

  let wc=DATA.weather.codes.filter(r=>inYears(r,f));if(f.month)wc=wc.filter(r=>r.month===f.month);weatherChart(wc);

  const ws=DATA.wind.speed_annual.filter(r=>inYears(r,f));
  const wm=DATA.wind.daily_max_annual.filter(r=>inYears(r,f));
  lineChart('windSpeed',ws.map(r=>r.year),[
    {label:'Årsmedel',data:ws.map(r=>r.avg)},
    {label:'Högsta dygnsmax',data:ws.map(r=>{const x=wm.find(m=>m.year===r.year);return x?x.max:null;})}
  ],'m/s');

  const wd=DATA.wind.direction_annual.filter(r=>inYears(r,f));
  destroyChart('windDirection');
  charts.windDirection=new Chart(document.getElementById('windDirection'),{type:'line',
    data:{labels:wd.map(r=>r.year),datasets:[{label:'Cirkulärt medel',data:wd.map(r=>r.avg),borderWidth:2,pointRadius:2,tension:.1}]},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'nearest',intersect:false},
      onHover:(e,els)=>{if(els.length){const i=els[0].index;updateCompass(wd[i].avg,wd[i].year);}},
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.parsed.y.toFixed(0)+'° ('+directionName(c.parsed.y)+')'}}},
      scales:{x:{grid:{display:false}},y:{min:0,max:360,title:{display:true,text:'grader'},ticks:{stepSize:45,callback:v=>v+'° '+directionName(v)}}}}});
  if(wd.length)updateCompass(wd[wd.length-1].avg,wd[wd.length-1].year);

  coverage.innerHTML='<table><thead><tr><th>Parameter</th><th>Från</th><th>Till</th><th>Observationer</th></tr></thead><tbody>'+
    DATA.coverage.map(r=>'<tr><td>'+r.name+'</td><td>'+r.min_date+'</td><td>'+r.max_date+'</td><td>'+r.rows.toLocaleString('sv-SE')+'</td></tr>').join('')+'</tbody></table>';
}
function syncFromInputs(source){
  let a=+rangeFrom.value,b=+rangeTo.value;
  if(a>b){if(source==='from')b=a;else a=b;}
  rangeFrom.value=a;rangeTo.value=b;yearFrom.value=a;yearTo.value=b;sliderLabel.textContent=a+'–'+b;render();
}
function setupTabs(){document.querySelectorAll('#tabs button').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('#tabs button').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));btn.classList.add('active');document.getElementById('page-'+btn.dataset.page).classList.add('active');setTimeout(()=>Object.values(charts).forEach(c=>c.resize()),50);}));}
function setupFilters(){
  const years=DATA.years,min=years[0],max=years[years.length-1];
  for(const id of ['yearFrom','yearTo'])document.getElementById(id).innerHTML=years.map(y=>'<option value="'+y+'">'+y+'</option>').join('');
  yearFrom.value=min;yearTo.value=max;
  [rangeFrom,rangeTo].forEach(x=>{x.min=min;x.max=max;x.step=1;});rangeFrom.value=min;rangeTo.value=max;sliderLabel.textContent=min+'–'+max;
  yearFrom.addEventListener('change',()=>{rangeFrom.value=yearFrom.value;syncFromInputs('from');});
  yearTo.addEventListener('change',()=>{rangeTo.value=yearTo.value;syncFromInputs('to');});
  rangeFrom.addEventListener('input',()=>syncFromInputs('from'));rangeTo.addEventListener('input',()=>syncFromInputs('to'));
  month.addEventListener('change',render);
  resetFilters.addEventListener('click',()=>{yearFrom.value=min;yearTo.value=max;rangeFrom.value=min;rangeTo.value=max;month.value='0';sliderLabel.textContent=min+'–'+max;render();});
}
fetch('dashboard_data.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('dashboard_data.json saknas');return r.json();}).then(d=>{
  DATA=d;updated.textContent='Data uppdaterad: '+(d.generated_at||'okänt');weatherSource.href=d.weather.source_url;setupTabs();setupFilters();render();
}).catch(err=>{document.querySelector('main').innerHTML='<div class="chart-card"><h2>Rapportdata saknas</h2><p>'+err.message+'</p></div>';});
