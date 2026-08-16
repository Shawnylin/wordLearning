import{l as d,d as v,c as a,a as e,u as i,p as k,b as c,t as l,F as g,i as x,f as z,o as s,e as w,q as _,B as C}from"./index-D_Ot21Ff.js";import{u as I}from"./idiom-BGnAKyLf.js";import{R as M}from"./refresh-cw-J9UcM4s4.js";import{L as F}from"./lightbulb-BtrAkUz_.js";/**
 * @license lucide-vue-next v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const H=d("FileTextIcon",[["path",{d:"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",key:"1rqfz7"}],["path",{d:"M14 2v4a2 2 0 0 0 2 2h4",key:"tnqrlb"}],["path",{d:"M10 9H8",key:"b1mrlr"}],["path",{d:"M16 13H8",key:"t4e002"}],["path",{d:"M16 17H8",key:"z1uh3a"}]]);/**
 * @license lucide-vue-next v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const q=d("HeartIcon",[["path",{d:"M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z",key:"c3ymky"}]]);/**
 * @license lucide-vue-next v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const B=d("Link2Icon",[["path",{d:"M9 17H7A5 5 0 0 1 7 7h2",key:"8i5ue5"}],["path",{d:"M15 7h2a5 5 0 1 1 0 10h-2",key:"1b9ql8"}],["line",{x1:"8",x2:"16",y1:"12",y2:"12",key:"1jonct"}]]);/**
 * @license lucide-vue-next v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const S=d("QuoteIcon",[["path",{d:"M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z",key:"rib7q0"}],["path",{d:"M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z",key:"1ymkrd"}]]);/**
 * @license lucide-vue-next v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const te=d("SearchIcon",[["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}],["path",{d:"m21 21-4.3-4.3",key:"1qie3q"}]]),L={class:"animate-card-enter"},V={class:"rounded-3xl card overflow-hidden"},j={class:"relative px-6 pt-8 pb-6 text-center bg-gradient-to-b from-zhuhong-soft to-card"},A=["title"],N=["disabled"],$={class:"text-lg tracking-widest mb-2 text-zhuhong"},D={class:"font-kai text-5xl md:text-6xl font-bold text-ink tracking-widest leading-tight"},Q={class:"px-6 pb-6 space-y-5"},R={class:"flex items-center gap-2 mb-2"},T={class:"flex items-center justify-center w-7 h-7 rounded-lg bg-zhuhong-soft text-zhuhong"},Z={class:"text-sm font-semibold text-ink-soft tracking-wide"},E={class:"text-base leading-relaxed text-ink-soft pl-9"},O={key:0},G={class:"flex items-center gap-2 mb-3"},J={class:"flex items-center justify-center w-7 h-7 rounded-lg bg-zhuhong-soft text-zhuhong"},K={class:"grid grid-cols-3 gap-2 pl-9"},P=["onClick","title"],oe=v({__name:"IdiomCard",props:{idiom:{},loading:{type:Boolean}},emits:["regenerate","relatedClick"],setup(t,{emit:f}){const r=I(),p=t,h=f,y=[{key:"explanation",label:"解释",icon:C},{key:"origin",label:"出处",icon:H},{key:"example",label:"例子",icon:S},{key:"usage",label:"用法",icon:F}];function b(m){return p.idiom[m]||""}return(m,n)=>{var u;return s(),a("div",L,[e("div",V,[e("div",j,[e("button",{onClick:n[0]||(n[0]=o=>i(r).toggleFavorite(t.idiom.word)),class:k(["absolute top-4 left-4 p-2 rounded-full transition-all duration-200",i(r).isFavorite(t.idiom.word)?"text-zhuhong hover:scale-110":"text-ink-mute hover:text-zhuhong"]),title:i(r).isFavorite(t.idiom.word)?"取消收藏":"收藏"},[c(i(q),{size:18,fill:i(r).isFavorite(t.idiom.word)?"currentColor":"none"},null,8,["fill"])],10,A),e("button",{onClick:n[1]||(n[1]=o=>h("regenerate")),disabled:t.loading,class:"absolute top-4 right-4 p-2 rounded-full text-ink-mute hover:text-zhuhong hover:bg-zhuhong-soft transition-all duration-200 disabled:opacity-50",title:"重新生成"},[c(i(M),{size:18,class:k({"animate-spin":t.loading})},null,8,["class"])],8,N),e("p",$,l(t.idiom.pinyin),1),e("h1",D,l(t.idiom.word),1)]),e("div",Q,[(s(),a(g,null,x(y,o=>e("div",{key:o.key},[e("div",R,[e("div",T,[(s(),w(_(o.icon),{size:14}))]),e("h3",Z,l(o.label),1)]),e("p",E,l(b(o.key)),1)])),64)),((u=t.idiom.relatedIdioms)==null?void 0:u.length)>0?(s(),a("div",O,[e("div",G,[e("div",J,[c(i(B),{size:14})]),n[2]||(n[2]=e("h3",{class:"text-sm font-semibold text-ink-soft tracking-wide"}," 相关成语 ",-1))]),e("div",K,[(s(!0),a(g,null,x(t.idiom.relatedIdioms,o=>(s(),a("button",{key:o,onClick:U=>h("relatedClick",o),class:"min-w-0 px-2 py-2 rounded-full text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis bg-soft text-ink-soft hover:bg-zhuhong-solid hover:text-paper-ink transition-colors duration-200",title:o},l(o),9,P))),128))])])):z("",!0)])])])}}});export{q as H,te as S,oe as _};
