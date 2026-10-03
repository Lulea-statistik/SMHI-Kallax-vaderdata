let DATA=null;const charts={};const months=['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];let temp2Start=null;
const el=id=>document.getElementById(id);
function destroyChart(id){if(charts[id]){charts[id].destroy();delete charts[id];}}
function lineChart(id,labels,datasets,yTitle,extra={}){destroyChart(id);charts[id]=new Chart(el(id),{type:'line',data:{labels,datasets:datasets.map(d=>({borderWidth:2,pointRadius:0,tension:.15,...d}))},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:datasets.length>1}},scales:{x:{grid:{display:false}},y:{title:{display:!!yTitle,text:yTitle}}},...extra}});}
function barChart(id,labels,data,yTitle){destroyChart(id);charts[id]=new Chart(el(id),{type:'bar',data:{labels,datasets:[{data,borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false}},y:{beginAtZero:true,title:{display:!!yTitle,text:yTitle}}}}});}
function currentFilters(){return{from:+el('yearFrom').value,to:+el('yearTo').value,month:+el('month').value};}
function inYears(r,f){return r.year>=f.from&&r.year<=f.to;}
function directionName(deg){const names=['N','NO','O','SO','S','SV','V','NV'];return names[Math.round((((deg||0)%360)+360)%360/45)%8];}
function updateCompass(deg,label=''){if(deg==null||Number.isNaN(+deg))return;const d=((+deg%360)+360)%360;el('windArrow').style.transform='translate(-50%,-100%) rotate('+d+'deg)';el('windCompassText').textContent=(label?label+' · ':'')+d.toFixed(0)+'° = vind från '+directionName(d);}
function circularFromParts(rows){let s=0,c=0,n=0;rows.forEach(r=>{s+=r.sin_sum||0;c+=r.cos_sum||0;n+=r.count||0;});if(!n||(!s&&!c))return null;let d=Math.atan2(s,c)*180/Math.PI;d=(d+360)%360;return d===0?360:d;}
function temperatureMetric(){return el('tempMetric').value;}
function metricName(m){return m==='min'?'Minimum':m==='max'?'Maximum':'Genomsnittlig';}
function weatherPhenomenon(code){
  let n=Number(code); if(!Number.isFinite(n)) return 'Okänt väderfenomen';
  if(n>=100) n=n%100;
  if(n<=3) return n===0?'Klart eller oförändrat väder':n===1?'Moln upplöses':n===2?'Oförändrad molnighet':'Moln utvecklas';
  if(n===4) return 'Rök'; if(n===5) return 'Dis'; if(n===6) return 'Damm'; if(n<=9) return 'Damm- eller sandfenomen';
  if(n===10) return 'Dis'; if(n<=12) return 'Marknära dimma'; if(n===13) return 'Blixt synlig'; if(n<=16) return 'Nederbörd i närheten';
  if(n===17) return 'Åska utan nederbörd'; if(n===18) return 'Kastvind'; if(n===19) return 'Tromb';
  if(n===20) return 'Duggregn'; if(n===21) return 'Regn'; if(n===22) return 'Snö'; if(n===23) return 'Regn och snö';
  if(n===24) return 'Underkyld nederbörd'; if(n===25) return 'Regnskur'; if(n===26) return 'Snöby'; if(n===27) return 'Hagelby';
  if(n===28) return 'Dimma'; if(n===29) return 'Åska'; if(n<=35) return 'Damm- eller sandstorm'; if(n<=39) return 'Drivande eller yrande snö';
  if(n<=49) return 'Dimma'; if(n<=59) return 'Duggregn'; if(n<=69) return 'Regn'; if(n<=79) return 'Snö eller annan fast nederbörd';
  if(n<=89) return 'Skurar'; if(n<=99) return 'Åska';
  return 'Väderfenomen';
}
function setupTemp2Slider(){
  const years=[...DATA.years].sort((a,b)=>a-b);
  const minStart=years[0],maxStart=years[years.length-1]-9;
  temp2Start=maxStart;
  const s=el('temp2Start');s.min=minStart;s.max=maxStart;s.step=1;s.value=temp2Start;
  s.addEventListener('input',e=>{temp2Start=+e.target.value;renderTemp2();});
  renderTemp2();
}
function renderTemp2(){
  const start=temp2Start??([...DATA.years].sort((a,b)=>a-b).slice(-10)[0]);
  const years=Array.from({length:10},(_,i)=>start+i).filter(y=>DATA.years.includes(y));
  el('temp2PeriodLabel').textContent=start+'–'+(start+9);
  lineChart('tempProfiles',months,years.map(y=>({label:String(y),data:[...Array(12)].map((_,i)=>{const r=DATA.temperature.monthly.find(x=>x.year===y&&x.month===i+1);return r?r.avg:null;})})),'°C');
}
function weatherChart(rows){
  destroyChart('weatherCodes');
  const selected=el('weatherCode').value;
  const years=[...new Set(rows.map(r=>r.year))].sort((a,b)=>a-b);
  const totals={};rows.forEach(r=>totals[r.year]=(totals[r.year]||0)+r.count);
  if(selected==='all'){
    const codes=[...new Set(rows.map(r=>String(r.code)))].sort((a,b)=>Number(a)-Number(b));
    const datasets=codes.map(code=>({label:weatherPhenomenon(code),data:years.map(y=>{const n=rows.filter(r=>r.year===y&&String(r.code)===code).reduce((s,r)=>s+r.count,0);return totals[y]?100*n/totals[y]:0;}),borderWidth:0}));
    charts.weatherCodes=new Chart(el('weatherCodes'),{type:'bar',data:{labels:years,datasets},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'nearest',intersect:true},plugins:{legend:{display:false},tooltip:{displayColors:false,callbacks:{title:items=>String(items[0].label),label:c=>(c.dataset.label||'')+': '+c.parsed.y.toFixed(1)+' %'}}},scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,min:0,max:100,title:{display:true,text:'Andel observationer (%)'},ticks:{callback:v=>v+' %'}}}}});
    el('weatherTitle').textContent='Rådande väder – fördelning per år';el('weatherHint').textContent='Alla koder visas som andel av årets observationer. Välj en kod ovan om du vill följa bara den.';
  }else{
    const vals=years.map(y=>{const n=rows.filter(r=>r.year===y&&String(r.code)===selected).reduce((s,r)=>s+r.count,0);return totals[y]?100*n/totals[y]:0;});
    charts.weatherCodes=new Chart(el('weatherCodes'),{type:'bar',data:{labels:years,datasets:[{data:vals,borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{displayColors:false,callbacks:{title:items=>String(items[0].label),label:c=>c.parsed.y.toFixed(1)+' %'}}},scales:{x:{grid:{display:false}},y:{beginAtZero:true,max:100,title:{display:true,text:'Andel observationer (%)'},ticks:{callback:v=>v+' %'}}}}});
    el('weatherTitle').textContent=weatherPhenomenon(selected)+' – andel observationer per år';el('weatherHint').textContent='Andel av samtliga väderobservationer det året som har vald kod.';
  }
}
function aggregateMonthlyMean(rows,key='avg'){return [...Array(12)].map((_,i)=>{const a=rows.filter(r=>r.month===i+1).map(r=>r[key]).filter(v=>v!=null);return a.length?a.reduce((s,v)=>s+v,0)/a.length:null;});}
function render(){
  const f=currentFilters(),m=temperatureMetric(),name=metricName(m);
  const ta=DATA.temperature.annual.filter(r=>inYears(r,f));lineChart('tempAnnual',ta.map(r=>r.year),[{label:'°C',data:ta.map(r=>r[m])}],'°C');el('tempAnnualTitle').textContent=name+' lufttemperatur per år';
  let tm=DATA.temperature.monthly.filter(r=>inYears(r,f));if(f.month)tm=tm.filter(r=>r.month===f.month);
  const tMonthAgg=[...Array(12)].map((_,i)=>{const rows=tm.filter(r=>r.month===i+1);if(!rows.length)return null;return m==='min'?Math.min(...rows.map(r=>r.min)):m==='max'?Math.max(...rows.map(r=>r.max)):rows.reduce((s,r)=>s+r.avg,0)/rows.length;});lineChart('tempMonthly',months,[{label:'°C',data:tMonthAgg}],'°C');el('tempMonthlyTitle').textContent=name+' lufttemperatur per månad';
  renderTemp2();

  const pa=DATA.precipitation.annual.filter(r=>inYears(r,f));barChart('precipAnnual',pa.map(r=>r.year),pa.map(r=>r.sum),'mm');
  let pm=DATA.precipitation.monthly_total.filter(r=>inYears(r,f));if(f.month)pm=pm.filter(r=>r.month===f.month);lineChart('precipMonthly',months,[{label:'mm',data:aggregateMonthlyMean(pm,'sum')}],'mm');

  let wc=DATA.weather.codes.filter(r=>inYears(r,f));if(f.month)wc=wc.filter(r=>r.month===f.month);weatherChart(wc);

  const ws=DATA.wind.speed_annual.filter(r=>inYears(r,f)),wm=DATA.wind.daily_max_annual.filter(r=>inYears(r,f));lineChart('windSpeed',ws.map(r=>r.year),[{label:'Årsmedel',data:ws.map(r=>r.avg)},{label:'Årets högsta dygnsmaximum',data:ws.map(r=>{const x=wm.find(a=>a.year===r.year);return x?x.max:null;})}],'m/s');

  const wd=DATA.wind.direction_annual.filter(r=>inYears(r,f));destroyChart('windDirection');charts.windDirection=new Chart(el('windDirection'),{type:'line',data:{labels:wd.map(r=>r.year),datasets:[{data:wd.map(r=>r.avg),borderWidth:2,pointRadius:2,tension:.1}]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'nearest',intersect:false},onHover:(e,pts)=>{if(pts.length){const i=pts[0].index;updateCompass(wd[i].avg,String(wd[i].year));}},plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.parsed.y.toFixed(0)+'° ('+directionName(c.parsed.y)+')'}}},scales:{x:{grid:{display:false}},y:{min:0,max:360,title:{display:true,text:'grader'},ticks:{stepSize:45,callback:v=>v+'° '+directionName(v)}}}}});
  const wdm=DATA.wind.direction_monthly.filter(r=>inYears(r,f));const monthly=[...Array(12)].map((_,i)=>circularFromParts(wdm.filter(r=>r.month===i+1)));destroyChart('windDirectionMonthly');charts.windDirectionMonthly=new Chart(el('windDirectionMonthly'),{type:'line',data:{labels:months,datasets:[{data:monthly,borderWidth:2,pointRadius:2,tension:.1}]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'nearest',intersect:false},onHover:(e,pts)=>{if(pts.length){const i=pts[0].index;updateCompass(monthly[i],months[i]);}},plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.parsed.y.toFixed(0)+'° ('+directionName(c.parsed.y)+')'}}},scales:{x:{grid:{display:false}},y:{min:0,max:360,title:{display:true,text:'grader'},ticks:{stepSize:45,callback:v=>v+'° '+directionName(v)}}}}});

  const va=DATA.visibility.annual.filter(r=>inYears(r,f));lineChart('visibilityAnnual',va.map(r=>r.year),[{label:'meter',data:va.map(r=>r.avg)}],'meter');
  let vm=DATA.visibility.monthly.filter(r=>inYears(r,f));if(f.month)vm=vm.filter(r=>r.month===f.month);lineChart('visibilityMonthly',months,[{label:'meter',data:aggregateMonthlyMean(vm)}],'meter');

  const ha=DATA.humidity.annual.filter(r=>inYears(r,f));lineChart('humidityAnnual',ha.map(r=>r.year),[{label:'%',data:ha.map(r=>r.avg)}],'%');
  let hm=DATA.humidity.monthly.filter(r=>inYears(r,f));if(f.month)hm=hm.filter(r=>r.month===f.month);lineChart('humidityMonthly',months,[{label:'%',data:aggregateMonthlyMean(hm)}],'%');

  let z=DATA.zero_crossings.filter(r=>inYears(r,f));if(f.month)z=z.filter(r=>r.month===f.month);
  const zy={};z.forEach(r=>zy[r.year]=(zy[r.year]||0)+1);const zYears=Object.keys(zy).map(Number).sort((a,b)=>a-b);barChart('zeroAnnual',zYears,zYears.map(y=>zy[y]),'dygn');
  const selectedYears=DATA.years.filter(y=>y>=f.from&&y<=f.to);const denom=Math.max(1,selectedYears.length);
  const zm=[...Array(12)].map((_,i)=>z.filter(r=>r.month===i+1).length/denom);barChart('zeroMonthly',months,zm,'dygn per år');
  el('zeroTable').innerHTML='<table><thead><tr><th>Datum</th><th>Min °C</th><th>Max °C</th><th>Antal genomgångar</th><th>Riktning</th><th>Observationer</th></tr></thead><tbody>'+z.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(r=>'<tr><td>'+r.date+'</td><td>'+r.min+'</td><td>'+r.max+'</td><td>'+r.crossings+'</td><td>'+r.directions.join(', ')+'</td><td>'+r.observations+'</td></tr>').join('')+'</tbody></table>';

  el('coverage').innerHTML='<table><thead><tr><th>Parameter</th><th>Från</th><th>Till</th><th>Observationer</th></tr></thead><tbody>'+DATA.coverage.map(r=>'<tr><td>'+r.name+'</td><td>'+r.min_date+'</td><td>'+r.max_date+'</td><td>'+r.rows.toLocaleString('sv-SE')+'</td></tr>').join('')+'</tbody></table>';
}
function syncYear(source,value){let a=+el('yearFrom').value,b=+el('yearTo').value;if(source==='from')a=+value;else b=+value;if(a>b){if(source==='from')b=a;else a=b;}el('yearFrom').value=a;el('yearTo').value=b;el('rangeFrom').value=a;el('rangeTo').value=b;el('rangeFromLabel').textContent=a;el('rangeToLabel').textContent=b;render();}
function setupTabs(){document.querySelectorAll('#tabs button').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('#tabs button').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));btn.classList.add('active');el('page-'+btn.dataset.page).classList.add('active');setTimeout(()=>Object.values(charts).forEach(c=>c.resize()),50);}));}
function setupFilters(){const years=DATA.years,min=years[0],max=years[years.length-1];['yearFrom','yearTo'].forEach(id=>el(id).innerHTML=years.map(y=>'<option value="'+y+'">'+y+'</option>').join(''));el('yearFrom').value=min;el('yearTo').value=max;['rangeFrom','rangeTo'].forEach(id=>{el(id).min=min;el(id).max=max;el(id).step=1;});el('rangeFrom').value=min;el('rangeTo').value=max;el('rangeFromLabel').textContent=min;el('rangeToLabel').textContent=max;el('yearFrom').addEventListener('change',e=>syncYear('from',e.target.value));el('yearTo').addEventListener('change',e=>syncYear('to',e.target.value));el('rangeFrom').addEventListener('input',e=>syncYear('from',e.target.value));el('rangeTo').addEventListener('input',e=>syncYear('to',e.target.value));el('month').addEventListener('change',render);el('tempMetric').addEventListener('change',render);el('weatherCode').addEventListener('change',render);el('resetFilters').addEventListener('click',()=>{syncYear('from',min);syncYear('to',max);el('month').value='0';render();});}
function setupWeatherCodes(){const codes=[...new Set(DATA.weather.codes.map(r=>String(r.code)))].sort((a,b)=>Number(a)-Number(b));el('weatherCode').innerHTML='<option value="all">Alla koder</option>'+codes.map(c=>'<option value="'+c+'">'+c+' – '+(DATA.weather.labels[c]||('Kod '+c))+'</option>').join('');el('weatherCode').value='all';}
fetch('dashboard_data.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('dashboard_data.json saknas');return r.json();}).then(d=>{DATA=d;el('updated').textContent='Data uppdaterad: '+(d.generated_at||'okänt');el('weatherSource').href=d.weather.source_url;setupWeatherCodes();setupTemp2Slider();setupTabs();setupFilters();render();}).catch(err=>{document.querySelector('main').innerHTML='<div class="chart-card"><h2>Rapportdata saknas</h2><p>'+err.message+'</p></div>';});