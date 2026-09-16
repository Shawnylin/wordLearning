import{l as d,d as r,m as c,c as m,C as u,n as b,h as l,u as s,r as f,o as i}from"./index-BY-Dthmb.js";import{R as g}from"./refresh-cw-DeLy09_t.js";/**
 * @license lucide-vue-next v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const h=d("ArrowUpIcon",[["path",{d:"m5 12 7-7 7 7",key:"hav0vg"}],["path",{d:"M12 19V5",key:"x0mq9r"}]]),y=["disabled","aria-label","aria-busy","title"],B=r({__name:"CommandSubmit",props:{loading:{type:Boolean},disabled:{type:Boolean},label:{}},setup(a){const o=a,n=f(!1);return c(()=>o.loading,(t,e)=>{n.value=!t&&!!e}),(t,e)=>(i(),m("button",{type:"submit",class:b(["word-command-action",{"is-generating":a.loading,"is-settling":n.value}]),disabled:a.disabled,"aria-label":a.loading?"正在生成":a.label,"aria-busy":a.loading,title:a.loading?"正在生成":a.label,onAnimationend:e[0]||(e[0]=u(k=>n.value=!1,["self"]))},[a.loading?(i(),l(s(g),{key:0,size:20,class:"word-command-refresh","aria-hidden":"true"})):(i(),l(s(h),{key:1,size:22,"aria-hidden":"true"}))],42,y))}});export{B as _};
