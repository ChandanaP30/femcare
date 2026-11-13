import pandas as pd, numpy as np
import sys as _sys
DATA=_sys.argv[1] if len(_sys.argv)>1 else '../CrMcyclelength_share.csv'
raw=pd.read_csv(DATA,encoding='utf-8-sig')
raw['start']=pd.to_datetime(raw.cycle_start_date,format='%m/%d/%y')
raw['conc']=raw.conception_cycle.astype(str).str.strip().str.lower().eq('yes')
raw=raw.sort_values(['new_id','start','cycle_number']).reset_index(drop=True)
def ewma(v,a=0.35):
    e=v[0]
    for x in v[1:]: e=a*x+(1-a)*e
    return e
def slope(v):
    n=len(v)
    if n<2: return 0.0
    xm=(n-1)/2; ym=sum(v)/n
    den=sum((i-xm)**2 for i in range(n))
    return sum((i-xm)*(x-ym) for i,x in enumerate(v))/den
def predict(hist, clamp, cap=2.0):
    if len(hist)>=2:
        p=ewma(hist)+max(-cap,min(cap,0.3*slope(hist)))
    elif len(hist)==1: p=hist[0]
    else: return 28
    return int(round(min(clamp[1],max(clamp[0],p))))
def run(rule):
    ev=[]
    for pid,g in raw.groupby('new_id',sort=False):
        st=g.start.to_numpy(); prov=g.cycle_length.to_numpy(float); conc=g.conc.to_numpy()
        ints=[int((st[i+1]-st[i])/np.timedelta64(1,'D')) for i in range(len(g)-1)]
        for k in range(1,len(g)):
            if np.isnan(prov[k]) or conc[k]: continue
            prior=ints[:k]
            if rule=='current':
                hist=[x for x in prior if 15<=x<=60]; clamp=(21,45)
            elif rule=='wide':
                hist=[x for x in prior if 15<=x<=120]; clamp=(15,120)
            else:  # personal
                kept=[]
                for x in prior:
                    if not (15<=x<=120): continue
                    if len(kept)>=2:
                        med=float(np.median(kept))
                        if x>1.7*med+5: continue   # suspected missed log
                    kept.append(x)
                hist=kept; clamp=(15,120)
            pred=predict(hist,clamp)
            ev.append((pid,prov[k],pred))
    d=pd.DataFrame(ev,columns=['id','target','pred']); d['err']=(d.pred-d.target).abs()
    return d
rows=[]
for r in ['current','wide','personal']:
    d=run(r)
    lg=d[d.target>60]
    rows.append({'rule':r,'n':len(d),'MAE_all':round(d.err.mean(),3),'RMSE_all':round(np.sqrt(((d.pred-d.target)**2).mean()),3),
                 'n_targets_over60':len(lg),'MAE_over60':round(lg.err.mean(),2) if len(lg) else None,
                 'MAE_le60':round(d[d.target<=60].err.mean(),3)})
print(pd.DataFrame(rows).to_string(index=False))

def run_hybrid():
    ev=[]
    for pid,g in raw.groupby('new_id',sort=False):
        st=g.start.to_numpy(); prov=g.cycle_length.to_numpy(float); conc=g.conc.to_numpy()
        ints=[int((st[i+1]-st[i])/np.timedelta64(1,'D')) for i in range(len(g)-1)]
        for k in range(1,len(g)):
            if np.isnan(prov[k]) or conc[k]: continue
            prior=ints[:k]
            base=[x for x in prior if 15<=x<=60]
            long_user = len(base)>=2 and np.median(base)>45
            if long_user:
                hist=[x for x in prior if 15<=x<=120]; clamp=(15,120)
            else:
                hist=base; clamp=(21,45)
            ev.append((pid,prov[k],predict(hist,clamp)))
    d=pd.DataFrame(ev,columns=['id','target','pred']); d['err']=(d.pred-d.target).abs()
    lg=d[d.target>60]
    return {'rule':'hybrid','n':len(d),'MAE_all':round(d.err.mean(),3),'RMSE_all':round(np.sqrt(((d.pred-d.target)**2).mean()),3),
            'n_targets_over60':len(lg),'MAE_over60':round(lg.err.mean(),2) if len(lg) else None,'MAE_le60':round(d[d.target<=60].err.mean(),3)}
print(pd.DataFrame([run_hybrid()]).to_string(index=False))
