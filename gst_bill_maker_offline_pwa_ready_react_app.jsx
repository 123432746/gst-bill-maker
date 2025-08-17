import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Download, Plus, Trash2, Settings, Printer, Share2, Lock, Unlock, Save, Upload } from "lucide-react";

// --- Helpers ---
const LS_KEY = "gst-bill-maker-v1";
const DEFAULT_GST_RATES = [0, 5, 12, 18, 28];
const STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Delhi","Goa","Gujarat","Haryana","Himachal Pradesh","Jammu & Kashmir","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Puducherry","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttarakhand","Uttar Pradesh","West Bengal"
];

function currency(n){
  if (!Number.isFinite(+n)) return "0.00";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(+n);
}

function uid(){ return Math.random().toString(36).slice(2,9); }

const demoItems = [
  { id: uid(), name: "Driveway Sealcoating", hsn: "9954", qty: 1, price: 2500, gst: 18 },
];

const defaultData = {
  profile: {
    bizName: "Your Business Name",
    owner: "Owner Name",
    phone: "",
    email: "",
    address: "",
    gstin: "",
    state: "Rajasthan",
    logo: "",
  },
  client: {
    name: "Client Name",
    phone: "",
    email: "",
    address: "",
    gstin: "",
    state: "Rajasthan",
  },
  invoice: {
    number: "INV-1001",
    date: new Date().toISOString().slice(0,10),
    due: "",
    placeOfSupply: "Rajasthan",
    interState: false,
    notes: "Thank you for your business.",
    terms: "Payment due upon receipt.",
    items: demoItems,
    shipping: 0,
    discount: 0,
  },
  proUnlocked: false,
  licenseKey: "",
};

function load(){
  try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : defaultData; } catch { return defaultData; }
}

function save(data){ localStorage.setItem(LS_KEY, JSON.stringify(data)); }

// --- Main App ---
export default function App(){
  const [data, setData] = useState(load());
  const [showPrint, setShowPrint] = useState(false);
  const printRef = useRef(null);

  useEffect(()=>{ save(data); }, [data]);

  const totals = useMemo(()=>{
    const sub = data.invoice.items.reduce((s,it)=> s + (Number(it.qty||0) * Number(it.price||0)), 0);
    const gstAmt = data.invoice.items.reduce((s,it)=> s + (Number(it.qty||0) * Number(it.price||0)) * (Number(it.gst||0)/100), 0);
    const discount = Number(data.invoice.discount||0);
    const shipping = Number(data.invoice.shipping||0);
    const taxable = Math.max(sub - discount, 0);
    const totalGST = taxable * (weightedGST(data.invoice.items));
    // Weighted GST when discount applies proportionally
    const cgst = (!data.invoice.interState) ? totalGST/2 : 0;
    const sgst = (!data.invoice.interState) ? totalGST/2 : 0;
    const igst = (data.invoice.interState) ? totalGST : 0;
    const grand = taxable + shipping + totalGST;
    return { sub, discount, shipping, cgst, sgst, igst, totalGST, grand };
  }, [data.invoice]);

  function weightedGST(items){
    const sub = items.reduce((s,it)=> s + (Number(it.qty||0) * Number(it.price||0)), 0);
    if (sub<=0) return 0;
    return items.reduce((s,it)=>{
      const line = Number(it.qty||0) * Number(it.price||0);
      return s + (line/sub) * (Number(it.gst||0)/100);
    }, 0);
  }

  function update(path, value){
    setData(prev=>{
      const next = structuredClone(prev);
      const keys = path.split(".");
      let cur = next;
      for(let i=0;i<keys.length-1;i++){ cur = cur[keys[i]]; }
      cur[keys.at(-1)] = value;
      // Auto set interState
      if (path.startsWith("client.state") || path.startsWith("invoice.placeOfSupply") || path.startsWith("profile.state")){
        const inter = next.profile.state !== next.client.state;
        next.invoice.interState = inter;
        next.invoice.placeOfSupply = next.client.state || next.profile.state;
      }
      return next;
    });
  }

  function addItem(){
    setData(prev=>({ ...prev, invoice: { ...prev.invoice, items: [...prev.invoice.items, { id: uid(), name: "", hsn: "", qty: 1, price: 0, gst: 18 }] }}));
  }

  function removeItem(id){
    setData(prev=>({ ...prev, invoice: { ...prev.invoice, items: prev.invoice.items.filter(i=>i.id!==id) }}));
  }

  function importJSON(e){
    const file = e.target.files?.[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try{ const json = JSON.parse(reader.result);
        setData(json);
      } catch(err){ alert("Invalid JSON"); }
    };
    reader.readAsText(file);
  }

  function exportJSON(){
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `gst-bill-${data.invoice.number}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  function printPDF(){
    setShowPrint(true);
    setTimeout(()=>{ window.print(); setShowPrint(false); }, 50);
  }

  function share(){
    if (navigator.share){
      navigator.share({ title: data.invoice.number, text: `Invoice ${data.invoice.number} — Total ${currency(totals.grand)}` });
    } else {
      alert("Sharing is not supported on this device");
    }
  }

  function unlockPro(key){
    // Simple offline license check pattern; replace with your own keys when selling
    const ok = typeof key === 'string' && /^NSQ-(?:2025|2026)-[A-Z0-9]{6}$/.test(key);
    if (ok){
      setData(prev=>({ ...prev, proUnlocked: true, licenseKey: key }));
    } else {
      alert("Invalid key. Contact support.");
    }
  }

  const watermark = !data.proUnlocked;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 p-3 sm:p-6">
      <style>{`
        @media print{
          .no-print{ display:none !important; }
          .print-area{ box-shadow:none !important; }
        }
      `}</style>
      <header className="no-print max-w-6xl mx-auto flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl bg-neutral-900 text-white grid place-items-center font-bold">GST</div>
          <div>
            <h1 className="text-xl font-semibold">GST Bill Maker</h1>
            <p className="text-xs text-neutral-500">Offline invoice & estimate maker for India</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportJSON} className="gap-2"><Download size={16}/> Backup</Button>
          <label className="inline-flex items-center">
            <input type="file" accept="application/json" className="hidden" onChange={importJSON} />
            <span className="px-3 py-2 rounded-xl bg-white border text-sm cursor-pointer flex items-center gap-2"><Upload size={16}/> Restore</span>
          </label>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="gap-2"><Settings size={16}/> Settings</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>App Settings</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-6">
                <div>
                  <Label>Unlock Pro</Label>
                  <div className="flex gap-2 mt-2">
                    <Input placeholder="Enter license key" value={data.licenseKey} onChange={e=>update("licenseKey", e.target.value)} />
                    {data.proUnlocked ? (
                      <Button className="gap-2" disabled><Unlock size={16}/> Unlocked</Button>
                    ):(
                      <Button className="gap-2" onClick={()=>unlockPro(data.licenseKey)}><Lock size={16}/> Unlock</Button>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 mt-2">Pro removes watermark, adds logo, unlimited clients, custom GST rates.</p>
                </div>
                <div>
                  <Label>Custom GST Rates {data.proUnlocked ? "" : <Badge variant="secondary" className="ml-2">Pro</Badge>}</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(data.customRates || DEFAULT_GST_RATES).map((r,i)=> (
                      <Badge key={i}>{r}%</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-4">
        <Card className="no-print">
          <CardHeader>
            <CardTitle>Business Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Business Name</Label>
                <Input value={data.profile.bizName} onChange={e=>update("profile.bizName", e.target.value)} />
              </div>
              <div>
                <Label>Owner</Label>
                <Input value={data.profile.owner} onChange={e=>update("profile.owner", e.target.value)} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={data.profile.phone} onChange={e=>update("profile.phone", e.target.value)} />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={data.profile.email} onChange={e=>update("profile.email", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label>Address</Label>
                <Textarea rows={2} value={data.profile.address} onChange={e=>update("profile.address", e.target.value)} />
              </div>
              <div>
                <Label>GSTIN</Label>
                <Input value={data.profile.gstin} onChange={e=>update("profile.gstin", e.target.value)} />
              </div>
              <div>
                <Label>State</Label>
                <Select value={data.profile.state} onValueChange={v=>update("profile.state", v)}>
                  <SelectTrigger><SelectValue placeholder="Select state"/></SelectTrigger>
                  <SelectContent>{STATES.map(s=> <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Logo {data.proUnlocked ? null : <Badge className="ml-2" variant="secondary">Pro</Badge>}</Label>
                <Input disabled={!data.proUnlocked} placeholder="Paste image URL (Pro)" value={data.profile.logo} onChange={e=>update("profile.logo", e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="no-print">
          <CardHeader>
            <CardTitle>Client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Name</Label>
                <Input value={data.client.name} onChange={e=>update("client.name", e.target.value)} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={data.client.phone} onChange={e=>update("client.phone", e.target.value)} />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={data.client.email} onChange={e=>update("client.email", e.target.value)} />
              </div>
              <div>
                <Label>GSTIN</Label>
                <Input value={data.client.gstin} onChange={e=>update("client.gstin", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label>Address</Label>
                <Textarea rows={2} value={data.client.address} onChange={e=>update("client.address", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label>State</Label>
                <Select value={data.client.state} onValueChange={v=>update("client.state", v)}>
                  <SelectTrigger><SelectValue placeholder="Select state"/></SelectTrigger>
                  <SelectContent>{STATES.map(s=> <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="no-print flex flex-row items-center justify-between">
            <CardTitle>Invoice</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2" onClick={addItem}><Plus size={16}/> Item</Button>
              <Button variant="outline" className="gap-2" onClick={share}><Share2 size={16}/> Share</Button>
              <Button className="gap-2" onClick={printPDF}><Printer size={16}/> Print / PDF</Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Editor */}
            <div className="no-print grid sm:grid-cols-2 gap-3 mb-4">
              <div>
                <Label>Invoice No.</Label>
                <Input value={data.invoice.number} onChange={e=>update("invoice.number", e.target.value)} />
              </div>
              <div>
                <Label>Invoice Date</Label>
                <Input type="date" value={data.invoice.date} onChange={e=>update("invoice.date", e.target.value)} />
              </div>
              <div>
                <Label>Due Date</Label>
                <Input type="date" value={data.invoice.due} onChange={e=>update("invoice.due", e.target.value)} />
              </div>
              <div>
                <Label>Place of Supply</Label>
                <Select value={data.invoice.placeOfSupply} onValueChange={v=>update("invoice.placeOfSupply", v)}>
                  <SelectTrigger><SelectValue placeholder="Select"/></SelectTrigger>
                  <SelectContent>{STATES.map(s=> <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={data.invoice.interState} onCheckedChange={v=>update("invoice.interState", v)} />
                <Label>{data.invoice.interState ? "Inter-State (IGST)" : "Intra-State (CGST+SGST)"}</Label>
              </div>
              <div></div>
            </div>

            {/* Items table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-100">
                  <tr>
                    <th className="text-left p-2">Item</th>
                    <th className="text-left p-2">HSN/SAC</th>
                    <th className="text-right p-2">Qty</th>
                    <th className="text-right p-2">Price</th>
                    <th className="text-right p-2">GST %</th>
                    <th className="text-right p-2">Amount</th>
                    <th className="p-2 no-print">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.invoice.items.map((it, idx)=>{
                    const line = Number(it.qty||0)*Number(it.price||0);
                    return (
                      <tr key={it.id} className="border-b">
                        <td className="p-2 min-w-[180px]"><Input value={it.name} onChange={e=>{
                          const v = e.target.value; setData(prev=>({ ...prev, invoice: { ...prev.invoice, items: prev.invoice.items.map(x=> x.id===it.id? { ...x, name:v }:x) } }));
                        }} /></td>
                        <td className="p-2 min-w-[100px]"><Input value={it.hsn} onChange={e=>{
                          const v = e.target.value; setData(prev=>({ ...prev, invoice: { ...prev.invoice, items: prev.invoice.items.map(x=> x.id===it.id? { ...x, hsn:v }:x) } }));
                        }} /></td>
                        <td className="p-2 text-right"><Input type="number" value={it.qty} onChange={e=>{
                          const v = Number(e.target.value); setData(prev=>({ ...prev, invoice: { ...prev.invoice, items: prev.invoice.items.map(x=> x.id===it.id? { ...x, qty:v }:x) } }));
                        }} /></td>
                        <td className="p-2 text-right"><Input type="number" value={it.price} onChange={e=>{
                          const v = Number(e.target.value); setData(prev=>({ ...prev, invoice: { ...prev.invoice, items: prev.invoice.items.map(x=> x.id===it.id? { ...x, price:v }:x) } }));
                        }} /></td>
                        <td className="p-2 text-right">
                          <Select value={String(it.gst)} onValueChange={v=>{
                            const val = Number(v); setData(prev=>({ ...prev, invoice: { ...prev.invoice, items: prev.invoice.items.map(x=> x.id===it.id? { ...x, gst:val }:x) } }));
                          }}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                              {(data.customRates || DEFAULT_GST_RATES).map(r=> <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2 text-right whitespace-nowrap">{currency(line)}</td>
                        <td className="p-2 no-print">
                          <Button variant="ghost" size="icon" onClick={()=>removeItem(it.id)}><Trash2 size={16}/></Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* totals */}
            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              <div className="space-y-3">
                <div>
                  <Label>Notes</Label>
                  <Textarea rows={3} value={data.invoice.notes} onChange={e=>update("invoice.notes", e.target.value)} />
                </div>
                <div>
                  <Label>Terms</Label>
                  <Textarea rows={3} value={data.invoice.terms} onChange={e=>update("invoice.terms", e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between"><span>Subtotal</span><span>{currency(totals.sub)}</span></div>
                <div className="flex items-center justify-between gap-2">
                  <span>Discount</span>
                  <Input className="w-36 text-right" type="number" value={data.invoice.discount} onChange={e=>update("invoice.discount", Number(e.target.value))} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Shipping</span>
                  <Input className="w-36 text-right" type="number" value={data.invoice.shipping} onChange={e=>update("invoice.shipping", Number(e.target.value))} />
                </div>
                {!data.invoice.interState ? (
                  <>
                    <div className="flex items-center justify-between"><span>CGST</span><span>{currency(totals.cgst)}</span></div>
                    <div className="flex items-center justify-between"><span>SGST</span><span>{currency(totals.sgst)}</span></div>
                  </>
                ):(
                  <div className="flex items-center justify-between"><span>IGST</span><span>{currency(totals.igst)}</span></div>
                )}
                <div className="flex items-center justify-between font-semibold text-lg pt-2 border-t"><span>Total</span><span>{currency(totals.grand)}</span></div>
              </div>
            </div>

            {/* Print view */}
            <div ref={printRef} className="print-area mt-6 bg-white rounded-2xl p-6 shadow-sm border">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold">{data.profile.bizName}</h2>
                  <div className="text-xs text-neutral-600 whitespace-pre-line">{data.profile.address}</div>
                  <div className="text-xs">GSTIN: {data.profile.gstin || "—"}</div>
                  <div className="text-xs">State: {data.profile.state}</div>
                </div>
                {data.profile.logo && data.proUnlocked ? (
                  <img src={data.profile.logo} alt="logo" className="w-24 h-24 object-contain"/>
                ) : null}
              </div>
              <div className="mt-4 grid sm:grid-cols-2 gap-4">
                <div>
                  <div className="font-semibold">Bill To:</div>
                  <div className="text-sm">{data.client.name}</div>
                  <div className="text-xs whitespace-pre-line">{data.client.address}</div>
                  <div className="text-xs">GSTIN: {data.client.gstin || "—"}</div>
                  <div className="text-xs">State: {data.client.state}</div>
                </div>
                <div className="text-sm">
                  <div>Invoice No: <span className="font-medium">{data.invoice.number}</span></div>
                  <div>Date: {data.invoice.date}</div>
                  {data.invoice.due && <div>Due: {data.invoice.due}</div>}
                  <div>Place of Supply: {data.invoice.placeOfSupply}</div>
                  <div>{data.invoice.interState ? "IGST" : "CGST + SGST"}</div>
                </div>
              </div>

              <table className="w-full text-sm mt-4">
                <thead className="bg-neutral-100">
                  <tr>
                    <th className="text-left p-2">Item</th>
                    <th className="text-left p-2">HSN/SAC</th>
                    <th className="text-right p-2">Qty</th>
                    <th className="text-right p-2">Price</th>
                    <th className="text-right p-2">GST %</th>
                    <th className="text-right p-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.invoice.items.map((it)=>{
                    const line = Number(it.qty||0)*Number(it.price||0);
                    return (
                      <tr key={it.id} className="border-b">
                        <td className="p-2">{it.name}</td>
                        <td className="p-2">{it.hsn}</td>
                        <td className="p-2 text-right">{it.qty}</td>
                        <td className="p-2 text-right">{currency(it.price)}</td>
                        <td className="p-2 text-right">{it.gst}%</td>
                        <td className="p-2 text-right">{currency(line)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div className="text-xs whitespace-pre-line">
                  <div className="font-medium mb-1">Notes</div>
                  {data.invoice.notes}
                  <div className="font-medium mt-3 mb-1">Terms</div>
                  {data.invoice.terms}
                </div>
                <div className="ml-auto w-full sm:w-80 text-sm">
                  <div className="flex items-center justify-between"><span>Subtotal</span><span>{currency(totals.sub)}</span></div>
                  <div className="flex items-center justify-between"><span>Discount</span><span>{currency(totals.discount)}</span></div>
                  <div className="flex items-center justify-between"><span>Shipping</span><span>{currency(totals.shipping)}</span></div>
                  {!data.invoice.interState ? (
                    <>
                      <div className="flex items-center justify-between"><span>CGST</span><span>{currency(totals.cgst)}</span></div>
                      <div className="flex items-center justify-between"><span>SGST</span><span>{currency(totals.sgst)}</span></div>
                    </>
                  ):(
                    <div className="flex items-center justify-between"><span>IGST</span><span>{currency(totals.igst)}</span></div>
                  )}
                  <div className="flex items-center justify-between font-semibold text-lg pt-2 border-t"><span>Total</span><span>{currency(totals.grand)}</span></div>
                </div>
              </div>

              {watermark && (
                <div className="mt-6 text-center text-xs text-neutral-400">Made with GST Bill Maker — Free version</div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="no-print max-w-6xl mx-auto mt-6 text-xs text-neutral-500 flex items-center justify-between">
        <div>
          Data saves to your device. Works offline.
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">PWA-ready</Badge>
          <Badge variant="outline">No backend needed</Badge>
        </div>
      </footer>
    </div>
  );
}
