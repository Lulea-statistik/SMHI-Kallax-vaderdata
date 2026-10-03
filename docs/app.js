let DATA=null;
const charts={};
const months=['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];

function destroyChart(id){ if(charts[id]){ charts[id].destroy(); delete charts[id]; } }
function lineChart(id,labels,datasets,yTitle){
  destroyChart(id);
  charts[id]=new Chart(document.getElementById(id),{
    type:'line',
    data:{labels,datasets:datasets.map(d=>({borderWidth:2,pointRadius:0,tension:.15,...d}))},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:datasets.length>1}},
      scales:{x:{grid:{display:false}},y:{title:{display:!!yTitle,text:yTitle}}}}
  });
}
function barChart(id,labels,data,yTitle){
  destroyChart(id);
  charts[id]=new Chart(document.getElementById(id),{
    type:'bar',data:{labels,datasets:[{data,borderWidth:0}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{x:{grid:{display:false}},y:{beginAtZero:true,title:{display:!!yTitle,text:yTitle}}}}
  });
}
function currentFilters(){
  return {from:+document.getElementById('yearFrom').value,to:+document.getElementById('yearTo').value,month:+document.getElementById('month').value};
}
function inYears(r,f){ return r.year>=f.from && r.year<=f.to; }

function render(){
  const f=currentFilters();
  const ta=DATA.temperature.annual.filter(r=>inYears(r,f));
  lineChart('tempAnnual',ta.map(r=>r.year),[{label:'°C',data:ta.map(r=>r.avg)}],'°C');

  let tm=DATA.temperature.monthly.filter(r=>inYears(r,f));
  if(f.month) tm=tm.filter(r=>r.month===f.month);
  const tMonthAgg=[...Array(12)].map((_,i)=>{
    const rows=tm.filter(r=>r.month===i+1);
    return rows.length? rows.reduce((s,r)=>s+r.avg,0)/rows.length : null;
  });
  lineChart('tempMonthly',months,[{label:'°C',data:tMonthAgg}],'°C');

  const years=[...new Set(DATA.temperature.monthly.filter(r=>inYears(r,f)).map(r=>r.year))].sort((a,b)=>a-b).slice(-10);
  const prof=years.map(y=>({
    label:String(y),
    data:[...Array(12)].map((_,i)=>{
      const r=DATA.temperature.monthly.find(x=>x.year===y&&x.month===i+1);
      return r?r.avg:null;
    })
  }));
  lineChart('tempProfiles',months,prof,'°C');

  const pa=DATA.precipitation.annual.filter(r=>inYears(r,f));
  barChart('precipAnnual',pa.map(r=>r.year),pa.map(r=>r.sum),'mm');

  let pm=DATA.precipitation.monthly_daily_avg.filter(r=>inYears(r,f));
  if(f.month) pm=pm.filter(r=>r.month===f.month);
  const pMonthAgg=[...Array(12)].map((_,i)=>{
    const rows=pm.filter(r=>r.month===i+1);
    return rows.length? rows.reduce((s,r)=>s+r.avg,0)/rows.length : null;
  });
  lineChart('precipMonthly',months,[{label:'mm',data:pMonthAgg}],'mm/dygn');

  let wc=DATA.weather.codes.filter(r=>inYears(r,f));
  if(f.month) wc=wc.filter(r=>r.month===f.month);
  const byCode={}; wc.forEach(r=>{byCode[r.code]=(byCode[r.code]||0)+r.count});
  const codes=Object.keys(byCode).sort((a,b)=>Number(a)-Number(b));
  barChart('weatherCodes',codes.map(x=>'Kod '+x),codes.map(x=>byCode[x]),'observationer');

  const ws=DATA.wind.speed_annual.filter(r=>inYears(r,f));
  lineChart('windSpeed',ws.map(r=>r.year),[{label:'m/s',data:ws.map(r=>r.avg)}],'m/s');
  const wd=DATA.wind.direction_annual.filter(r=>inYears(r,f));
  lineChart('windDirection',wd.map(r=>r.year),[{label:'grader',data:wd.map(r=>r.avg)}],'grader');

  document.getElementById('coverage').innerHTML='<table><thead><tr><th>Parameter</th><th>Från</th><th>Till</th><th>Observationer</th></tr></thead><tbody>'+
    DATA.coverage.map(r=>'<tr><td>'+r.name+'</td><td>'+r.min_date+'</td><td>'+r.max_date+'</td><td>'+r.rows.toLocaleString('sv-SE')+'</td></tr>').join('')+
    '</tbody></table>';
}

function setupTabs(){
  document.querySelectorAll('#tabs button').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('#tabs button').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('page-'+btn.dataset.page).classList.add('active');
    setTimeout(()=>Object.values(charts).forEach(c=>c.resize()),50);
  }));
}
function setupFilters(){
  const years=DATA.years;
  for(const id of ['yearFrom','yearTo']){
    const s=document.getElementById(id);
    s.innerHTML=years.map(y=>'<option value="'+y+'">'+y+'</option>').join('');
  }
  document.getElementById('yearFrom').value=years[0];
  document.getElementById('yearTo').value=years[years.length-1];
  ['yearFrom','yearTo','month'].forEach(id=>document.getElementById(id).addEventListener('change',render));
  document.getElementById('resetFilters').addEventListener('click',()=>{
    document.getElementById('yearFrom').value=years[0];
    document.getElementById('yearTo').value=years[years.length-1];
    document.getElementById('month').value='0'; render();
  });
}
fetch('dashboard_data.json',{cache:'no-store'}).then(r=>{
  if(!r.ok) throw new Error('dashboard_data.json saknas');
  return r.json();
}).then(d=>{
  DATA=d;
  document.getElementById('updated').textContent='Data uppdaterad: '+(d.generated_at||'okänt');
  setupTabs(); setupFilters(); render();
}).catch(err=>{
  document.querySelector('main').innerHTML='<div class="chart-card"><h2>Rapportdata saknas</h2><p>'+err.message+'</p><p>Kör GitHub Action <b>Update SMHI Kallax weather data</b> efter att rapportfilerna har lagts in.</p></div>';
});
