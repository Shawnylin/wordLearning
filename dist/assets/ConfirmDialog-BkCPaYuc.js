import{c as f,d as p,H as b,s as y,p as u,I as k,b as o,k as s,x as r,i as d,r as g,u as v,o as C,_}from"./index-rd6rpCJp.js";/**
 * @license lucide-vue-next v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const L=f("ClockIcon",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["polyline",{points:"12 6 12 12 16 14",key:"68esgv"}]]);/**
 * @license lucide-vue-next v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const M=f("SearchIcon",[["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}],["path",{d:"m21 21-4.3-4.3",key:"1qie3q"}]]),$=["aria-labelledby","aria-describedby"],x={class:"confirm-dialog-body"},I=["id"],h=["id"],B={class:"confirm-dialog-actions"},S=p({__name:"ConfirmDialog",props:{title:{},description:{},confirmLabel:{}},emits:["cancel","confirm"],setup(a,{emit:m}){const i=m,c=g(),n=v();return b(()=>{var t;return(t=c.value)==null?void 0:t.showModal()}),y(()=>{var t;return(t=c.value)==null?void 0:t.close()}),(t,e)=>(C(),u(k,{to:"body"},[o("dialog",{ref_key:"dialog",ref:c,class:"confirm-dialog","aria-labelledby":`${s(n)}-title`,"aria-describedby":`${s(n)}-description`,onCancel:e[2]||(e[2]=d(l=>i("cancel"),["prevent"])),onClick:e[3]||(e[3]=d(l=>i("cancel"),["self"]))},[o("div",x,[o("h2",{id:`${s(n)}-title`},r(a.title),9,I),o("p",{id:`${s(n)}-description`},r(a.description),9,h),o("div",B,[o("button",{type:"button",autofocus:"",onClick:e[0]||(e[0]=l=>i("cancel"))},"取消"),o("button",{type:"button",class:"btn-primary",onClick:e[1]||(e[1]=l=>i("confirm"))},r(a.confirmLabel||"确认删除"),1)])])],40,$)]))}}),q=_(S,[["__scopeId","data-v-5be184c9"]]);export{q as C,M as S,L as a};
