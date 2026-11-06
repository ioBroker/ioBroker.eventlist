import{createRoot as e,Fragment as t,jsx as n,jsxs as r}from"../../../lib/esm/react-19.js";var i=`iob-dialog-close`;function a(e){return!!e.form}var o=[`header`,`staticText`,`divider`];function s(e,t){return e==null?``:typeof e==`object`?e[t]||e.en||Object.values(e).find(e=>!!e)||``:String(e)}function c(e){let t={};for(let[n,r]of Object.entries(e.items||{}))r&&!o.includes(r.type)&&(t[n]=r.type);return t}function l(e){return typeof e==`string`?e:typeof e==`number`||typeof e==`boolean`?e.toString():JSON.stringify(e)}function u(e,t){if(t!=null)switch(e){case`number`:case`slider`:{if(typeof t==`number`)return Number.isFinite(t)?t:void 0;let e=l(t).trim().replace(`,`,`.`);if(!e)return;let n=Number(e);return Number.isFinite(n)?n:void 0}case`checkbox`:return t===!0||t===`true`||t===1||t===`1`;default:return l(t)}}function d(e,t){let n={};for(let[r,i]of Object.entries(e)){let e=u(i,t[r]);e!==void 0&&(n[r]=e)}return n}var f=`"Roboto", "Helvetica", "Arial", sans-serif`,p=Object.freeze({type:`light`,primary:`#3399CC`,primaryContrast:`#FFFFFF`,secondary:`#164477`,secondaryContrast:`#FFFFFF`,background:`#FFFFFF`,paper:`#FFFFFF`,text:`rgba(0, 0, 0, 0.87)`,textSecondary:`rgba(0, 0, 0, 0.6)`,divider:`rgba(0, 0, 0, 0.12)`,error:`#D32F2F`,warning:`#ED6C02`,info:`#0288D1`,success:`#2E7D32`,fontFamily:f,fontSize:14,borderRadius:4}),m=Object.freeze({type:`dark`,primary:`#4DABF5`,primaryContrast:`rgba(0, 0, 0, 0.87)`,secondary:`#436A93`,secondaryContrast:`#FFFFFF`,background:`#121212`,paper:`#121212`,text:`#FFFFFF`,textSecondary:`rgba(255, 255, 255, 0.7)`,divider:`rgba(255, 255, 255, 0.12)`,error:`#F44336`,warning:`#FFA726`,info:`#29B6F6`,success:`#66BB6A`,fontFamily:f,fontSize:14,borderRadius:4}),h=[`primary`,`primaryContrast`,`secondary`,`secondaryContrast`,`background`,`paper`,`text`,`textSecondary`,`divider`,`error`,`warning`,`info`,`success`,`fontFamily`],g=[`fontSize`,`borderRadius`];function _(e){return{...e===`dark`?m:p}}function v(e){if(!e||typeof e!=`object`)return _(typeof e==`string`?e:`light`);let t=e,n=_(typeof t.type==`string`?t.type:`light`);for(let e of h){let r=t[e];typeof r==`string`&&r.trim()&&(n[e]=r.trim())}for(let e of g){let r=t[e],i=typeof r==`string`?parseFloat(r):r;typeof i==`number`&&Number.isFinite(i)&&i>=0&&(n[e]=i)}return n}function y(e,t){return e.type===t.type&&h.every(n=>e[n]===t[n])&&g.every(n=>e[n]===t[n])}function b(e){return`--iob-${e.replace(/[A-Z]/g,e=>`-${e.toLowerCase()}`)}`}function x(e){let t={};for(let n of h)t[b(n)]=e[n];for(let n of g)t[b(n)]=`${e[n]}px`;return t[`color-scheme`]=e.type,t}var S={ok:{en:`OK`,"zh-cn":`确定`},cancel:{en:`Cancel`,de:`Abbrechen`,ru:`Отмена`,pt:`Cancelar`,nl:`Annuleren`,fr:`Annuler`,it:`Annulla`,es:`Cancelar`,pl:`Anuluj`,uk:`Скасувати`,"zh-cn":`取消`},close:{en:`Close`,de:`Schließen`,ru:`Закрыть`,pt:`Fechar`,nl:`Sluiten`,fr:`Fermer`,it:`Chiudi`,es:`Cerrar`,pl:`Zamknij`,uk:`Закрити`,"zh-cn":`关闭`}},C=`
dialog {
    box-sizing: border-box;
    width: 480px;
    max-width: calc(100vw - 32px);
    max-height: calc(100vh - 32px);
    padding: 0;
    border: 0;
    border-radius: calc(var(--iob-border-radius) * 2);
    background: var(--iob-paper);
    color: var(--iob-text);
    font-family: var(--iob-font-family);
    font-size: var(--iob-font-size);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}
/* as the dialogs of MUI: a dark paper gets lighter the higher it lies */
dialog.dark { background-image: linear-gradient(rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.16)); }
dialog::backdrop { background: rgba(0, 0, 0, 0.5); }
dialog:focus { outline: none; }
form { display: flex; flex-direction: column; height: 100%; max-height: inherit; margin: 0; }
header { display: flex; align-items: center; gap: 8px; padding: 12px 8px 12px 16px; font-size: 1.15em; font-weight: 500; }
header span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.body { flex: 1; min-height: 0; padding: 0 16px 16px; overflow: auto; display: flex; flex-direction: column; gap: 12px; }
footer { display: flex; justify-content: flex-end; gap: 8px; padding: 0 16px 16px; }
button { font: inherit; padding: 6px 16px; border-radius: var(--iob-border-radius); border: 1px solid var(--iob-primary); background: transparent; color: var(--iob-primary); cursor: pointer; }
button.primary { background: var(--iob-primary); color: var(--iob-primary-contrast); }
button.close { border: 0; padding: 2px 8px; font-size: 1.4em; line-height: 1; color: var(--iob-text-secondary); }
label { display: flex; flex-direction: column; gap: 4px; }
label.check { flex-direction: row; align-items: center; gap: 8px; }
input, select, textarea { font: inherit; accent-color: var(--iob-primary); }
.help { color: var(--iob-text-secondary); font-size: 0.85em; }
h3 { margin: 4px 0 0; font-size: 1em; }
p { margin: 0; }
hr { width: 100%; border: 0; border-top: 1px solid var(--iob-divider); margin: 0; }
[hidden] { display: none !important; }
`;function w(e){if(!e)return null;try{let t=Function(`data`,`return (${e});`);return e=>{try{return!!t(e)}catch{return!1}}}catch{return null}}function T(e){return typeof e==`string`?e:typeof e==`number`||typeof e==`boolean`?String(e):``}function E(e){let{input:t,setting:n}=e;if(t)return t instanceof HTMLInputElement&&t.type===`checkbox`?t.checked:t instanceof HTMLSelectElement?n.options?.[t.selectedIndex]?.value:t.value}function D(e,t,n,r,i){let a={name:t,setting:n,box:e.createElement(`div`),hidden:w(n.hidden),disabled:w(n.disabled)},o=s(n.label,i);switch(n.type){case`header`:return a.box=e.createElement(`h3`),a.box.textContent=s(n.text,i)||o,a;case`staticText`:return a.box=e.createElement(`p`),a.box.textContent=s(n.text,i)||o,a;case`divider`:return a.box=e.createElement(`hr`),a}let c=e.createElement(`label`);a.box=c;let l=e.createElement(`span`);if(l.textContent=o||t,n.type===`checkbox`){let t=e.createElement(`input`);t.type=`checkbox`,t.checked=r===!0||r===`true`,c.className=`check`,c.append(t,l),a.input=t}else if(n.type===`select`){let t=e.createElement(`select`);for(let r of n.options||[]){let n=e.createElement(`option`);n.textContent=s(r.label,i),t.append(n)}let o=(n.options||[]).findIndex(e=>String(e.value)===T(r));t.selectedIndex=o===-1?0:o,c.append(l,t),a.input=t}else if(n.type===`text`&&(n.minRows||1)>1){let t=e.createElement(`textarea`);t.rows=n.minRows||2,t.value=T(r),c.append(l,t),a.input=t}else{let t=e.createElement(`input`),i=T(r);switch(n.type){case`number`:case`slider`:t.type=n.type===`slider`?`range`:`number`,n.min!==void 0&&(t.min=String(n.min)),n.max!==void 0&&(t.max=String(n.max)),t.step=n.step===void 0?`any`:String(n.step);break;case`password`:t.type=`password`;break;case`color`:t.type=!i||/^#[0-9a-f]{6}$/i.test(i)?`color`:`text`;break;default:t.type=`text`}if(t.value=i,t.type===`range`){let n=e.createElement(`output`);n.textContent=t.value,t.addEventListener(`input`,()=>n.textContent=t.value),l.append(`: `,n)}c.append(l,t),a.input=t}if(n.help){let t=e.createElement(`span`);t.className=`help`,t.textContent=s(n.help,i),c.append(t)}return a}function O(e,t={}){let n=t.lang||`en`,r=document,o=e=>S[e][n]||S[e].en||e,l=r.createElement(`div`);l.setAttribute(`data-iob-dialog`,``);let u=l.attachShadow({mode:`open`}),f=r.createElement(`style`);f.textContent=C;let p=r.createElement(`dialog`),m=v(t.theme);p.className=m.type===`dark`?`dark`:``;for(let[e,t]of Object.entries(x(m)))p.style.setProperty(e,t);e.width&&(p.style.width=`${e.width}px`),e.height&&(p.style.height=`${e.height}px`);let h=r.createElement(`form`),g=r.createElement(`header`),_=r.createElement(`span`);_.textContent=s(e.title,n);let y=r.createElement(`button`);y.type=`button`,y.className=`close`,y.title=o(`close`),y.setAttribute(`aria-label`,o(`close`)),y.textContent=`×`,g.append(_,y);let b=r.createElement(`div`);return b.className=`body`,h.append(g,b),p.append(h),u.append(f,p),new Promise(t=>{let f=!1,m=e=>{f||(f=!0,p.open&&p.close(),l.remove(),t(e))};if(y.addEventListener(`click`,()=>m(null)),p.addEventListener(`close`,()=>m(null)),h.addEventListener(`submit`,e=>e.preventDefault()),a(e)){let t={},i=[];for(let[t,a]of Object.entries(e.form.items||{})){let o=e.data?.[t]??a.default,s=D(r,t,a,o,n);i.push(s),b.append(s.box)}let a=()=>{for(let e of i)e.input&&(t[e.name]=E(e));return t},l=()=>{let e=a();for(let t of i)t.box.hidden=t.hidden?t.hidden(e):!1,t.input&&(t.input.disabled=t.disabled?t.disabled(e):!1)};h.addEventListener(`input`,l),h.addEventListener(`change`,l),l();let u=i.find(e=>e.input&&!e.box.hidden&&!e.input.disabled);u?.input&&(u.input.autofocus=!0);let f=r.createElement(`footer`),p=r.createElement(`button`);p.type=`button`,p.textContent=s(e.cancel,n)||o(`cancel`),p.addEventListener(`click`,()=>m(null));let g=r.createElement(`button`);g.type=`submit`,g.className=`primary`,g.textContent=s(e.ok,n)||o(`ok`),f.append(p,g),h.append(f),h.addEventListener(`submit`,()=>m(d(c(e.form),a())))}else b.append(e.element),p.addEventListener(i,e=>m(e.detail??null));r.body.append(l),p.showModal(),u.activeElement&&u.activeElement!==y||(p.tabIndex=-1,p.focus())})}function k(e){return[...new Set(e.filter(e=>typeof e==`string`&&!!e))]}var ee=[`socket`,`dialogs`,`theme`,`editMode`,`settings`,`value`],A=class extends HTMLElement{states={};objects={};#e=null;#t={};#n=v(`light`);#r=!1;#i=null;#a=void 0;#o=null;#s=!1;#c=(e,t)=>{this.#o?.states.includes(e)&&(this.states[e]=t||null,this.#_())};#l=(e,t)=>{this.#o?.objects.includes(e)&&(this.objects[e]=t||null,this.#d())};get socket(){return this.#e}set socket(e){this.#e=e||null,this.#d()}get settings(){return this.#t}set settings(e){this.#t=e||{},this.#d()}get theme(){return this.#n}set theme(e){let t=v(e);y(t,this.#n)||(this.#n=t,this.#u(),this.#_())}get editMode(){return this.#r}set editMode(e){let t=!!e;t!==this.#r&&(this.#r=t,this.#_())}get dialogs(){return this.#i}set dialogs(e){this.#i=e||null}get value(){return this.#a}set value(e){e!==this.#a&&(this.#a=e,this.#_())}connectedCallback(){for(let e of ee)if(Object.prototype.hasOwnProperty.call(this,e)){let t=this[e];delete this[e],this[e]=t}this.#u(),this.#d()}disconnectedCallback(){this.#g()}getStateIds(e){return[]}getObjectIds(e){return[]}get systemLang(){return this.#e?.systemLang||`en`}text(e){return s(e,this.systemLang)}setState(e,t){return this.#e&&!this.#r?this.#e.setState(e,t):Promise.resolve()}changeValue(e){return this.#r||this.emit(`iob-change`,e)?!1:(this.value=e,!0)}emit(e,t){return this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0,cancelable:!0}))}async openDialog(e){if(this.#r)return null;let t=this.#i?await this.#i.open(e):await O(e,{lang:this.systemLang,theme:this.#n});return a(e)?t&&typeof t==`object`?d(c(e.form),t):null:t??null}#u(){for(let[e,t]of Object.entries(x(this.#n)))this.style.setProperty(e,t)}#d(){if(!this.isConnected)return;let e=this.#e,t=e?k(this.getStateIds(this.#t)):[],n=e?k(this.getObjectIds(this.#t)):[];this.#o&&this.#o.socket!==e&&this.#g();let r=this.#o?.states||[],i=this.#o?.objects||[],a=r.filter(e=>!t.includes(e)),o=i.filter(e=>!n.includes(e)),s=t.filter(e=>!r.includes(e)),c=n.filter(e=>!i.includes(e));e&&a.length&&e.unsubscribeState(a,this.#c),e&&o.length&&this.#h(e,o);for(let e of a)delete this.states[e];for(let e of[...a,...o])!t.includes(e)&&!n.includes(e)&&delete this.objects[e];this.#o=e&&(t.length||n.length)?{socket:e,states:t,objects:n}:null,e&&s.length&&this.#p(e,s),e&&c.length&&this.#m(e,c),this.#_()}#f(e,t,n){return this.#o?.socket===e&&this.#o[t].includes(n)}#p(e,t){e.subscribeState(t,this.#c).catch(e=>console.warn(`<${this.localName}>: cannot subscribe ${t.join(`, `)}: ${e}`));for(let n of t)e.getState(n).then(t=>{this.#f(e,`states`,n)&&this.states[n]===void 0&&(this.states[n]=t||null,this.#_())}).catch(()=>{}),e.getObject(n).then(t=>{this.#f(e,`states`,n)&&!this.#f(e,`objects`,n)&&(this.objects[n]=t||null,this.#_())}).catch(()=>{})}#m(e,t){e.subscribeObject(t,this.#l).catch(e=>console.warn(`<${this.localName}>: cannot subscribe the objects ${t.join(`, `)}: ${e}`));for(let n of t)e.getObject(n).then(t=>{this.#f(e,`objects`,n)&&(this.objects[n]=t||null,this.#d())}).catch(()=>{})}#h(e,t){e.unsubscribeObject(t,this.#l).catch(()=>{})}#g(){if(this.#o){let{socket:e,states:t,objects:n}=this.#o;t.length&&e.unsubscribeState(t,this.#c),n.length&&this.#h(e,n),this.#o=null}this.states={},this.objects={}}#_(){this.#s||(this.#s=!0,queueMicrotask(()=>{this.#s=!1,this.isConnected&&this.render()}))}};function te(e,t){let n=typeof e==`string`?e:e.tag;customElements.get(n)||customElements.define(n,t)}function j(e){return`iob-${e}`}function M(e){let t=(e||``).trim().match(/^(?:eventlist\.)?(\d+)$/);return t?`eventlist.${t[1]}`:null}function ne(e){let t=(e||``).split(`,`).map(e=>e.trim()).filter(e=>e);return t.length?t:null}function N(e,t){return t&&t>0?e.slice(0,t):e}function re(e){if(!e)return[];if(Array.isArray(e))return e;if(typeof e==`string`)try{let t=JSON.parse(e);return Array.isArray(t)?t:[]}catch{return console.warn(`Cannot parse event list: "${e}"`),[]}return[]}var P={fatal:`#B3122B`,alarm:`#D9601A`,warning:`#E0A800`,info:`#4A7FA5`};function ie(e){if(!e)return[];if(Array.isArray(e))return e;if(typeof e==`string`)try{let t=JSON.parse(e);return Array.isArray(t)?t:[]}catch{return console.warn(`Cannot parse message list: "${e}"`),[]}return[]}function ae(e,t){if(e<6e4)return t(`just_now`);let n=Math.floor(e/6e4);if(n<60)return`${n} ${t(`minutes`)}`;let r=Math.floor(n/60);if(r<24){let e=n%60;return`${r} ${t(`hours`)}${e?` ${e} ${t(`minutes`)}`:``}`}return`${Math.floor(r/24)} ${t(`days`)}${r%24?` ${r%24} ${t(`hours`)}`:``}`}function oe(e){if(!e)return[];if(Array.isArray(e))return e;if(typeof e==`string`)try{let t=JSON.parse(e);return Array.isArray(t)?t:[]}catch{return console.warn(`Cannot parse the alarm journal: "${e}"`),[]}return[]}function F(e){return e?new Date(e).toLocaleString():void 0}var se=3e4;function I(){return new URL(
/* @vite-ignore */
`../../../`,import.meta.url)}var L=class{#e;#t;#n=[];constructor(e){this.#e=e}get(e){return e===void 0?null:(e!==this.#t&&(this.#t=e,this.#n=this.#e(e?.val)),this.#n)}};function R(){return new L(re)}function z(){return new L(ie)}function B(){return new L(oe)}function V(e,t){return t?e.filter(e=>t.includes(e.id||``)):e}function H(e){let t=Date.now()-3e5;return[{id:`sample`,level:`alarm`,text:e(`sample_message`),state:`K`,active:!0,acked:!1,requiresAck:!0,ackable:!0,ts:t,lastTs:t,count:1,priority:50,val:92,unit:`%`,color:P.alarm}]}function U(e){return e.color||P[e.level]||P.info}function W(e,t){return(e.alarmName||t(`level_${e.level}`)).toUpperCase()}function G(e,t){return e==null?``:`${e.toString()}${t||``}`}function K(e){if(!e||e.endsWith(`default`))return null;if(/^(data:image\/|https?:\/\/)/.test(e))return e;let t=e.match(/^\/?([a-z0-9_-]+)\.admin\/(.+)$/i);return t?new URL(`adapter/${t[1]}/${t[2]}`,I()).href:null}function ce(e,t,n){let r=URL.createObjectURL(new Blob([e],{type:n})),i=document.createElement(`a`);i.href=r,i.download=t,document.body.appendChild(i),i.click(),i.remove(),URL.revokeObjectURL(r)}var le=`
:host {
    display: block;
    width: 100%;
    height: 100%;
}
.mount {
    width: 100%;
    height: 100%;
    /* the size of the box does not depend on what is in it */
    container-type: size;
}
.edit {
    pointer-events: none;
}
.hint {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(2px, 3cqmin, 8px);
    overflow: hidden;
    text-align: center;
    color: var(--iob-text-secondary);
    font-size: clamp(10px, 7cqmin, 15px);
}
.hint svg {
    width: clamp(16px, 14cqmin, 32px);
    height: clamp(16px, 14cqmin, 32px);
    fill: currentColor;
    flex: none;
}
`,q=`
.list {
    width: 100%;
    height: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    font-size: clamp(11px, 3.5cqw, 14px);
}
table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
}
th,
td {
    padding: 0.2em 0.45em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
}
th {
    font-weight: 600;
    font-size: 0.85em;
    color: var(--iob-text-secondary);
    border-bottom: 1px solid var(--iob-divider);
}
tbody tr:nth-child(even) {
    background: color-mix(in srgb, currentColor 5%, transparent);
}
.r {
    text-align: right;
}
.m {
    text-align: center;
}
.num {
    font-variant-numeric: tabular-nums;
}
.empty {
    padding: 0.4em 0.45em;
    color: var(--iob-text-secondary);
    font-style: italic;
}
.c-time {
    width: 30%;
}
.c-value {
    width: 20%;
}
.c-duration {
    width: 18%;
}
.c-level {
    width: 6.5em;
}
.c-state {
    width: 3em;
}
.c-cycle {
    width: 7em;
}
.c-since,
.c-mvalue,
.c-group {
    width: 6em;
}
.c-count {
    width: 3.5em;
}
.c-came,
.c-gone {
    width: 10em;
}
@container (max-width: 320px) {
    .c-time {
        width: 38%;
    }
    .c-came,
    .c-gone {
        width: 7em;
    }
}
.chip {
    display: inline-block;
    max-width: 100%;
    box-sizing: border-box;
    padding: 0 0.5em;
    border-radius: var(--iob-border-radius);
    color: #fff;
    font-weight: 700;
    font-size: 0.75em;
    line-height: 1.6;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: middle;
}
.code {
    font-family: monospace;
    font-weight: 700;
}
tr.unacked {
    font-weight: 700;
}
tr.gone,
tr.closed {
    opacity: 0.6;
}
tr.ackable {
    cursor: pointer;
}
tr.ackable:hover {
    background: color-mix(in srgb, var(--iob-primary) 14%, transparent);
}
`,J=`
.panel {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.2em;
    overflow: hidden;
    font-size: clamp(11px, 3.2cqw, 14px);
}
.panel .list {
    height: auto;
    font-size: inherit;
}
.section {
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
}
.title {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5em;
    padding: 0.35em 0.45em 0.1em;
    font-size: 0.8em;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--iob-text-secondary);
}
.summary {
    flex: none;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.2em 1.2em;
    padding: 0.2em 0.45em;
}
.summary .count {
    font-size: 1.5em;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
}
.summary .label {
    margin-left: 0.3em;
    font-size: 0.75em;
    text-transform: uppercase;
    color: var(--iob-text-secondary);
}
button.export {
    font: inherit;
    font-size: 0.95em;
    letter-spacing: normal;
    text-transform: none;
    color: inherit;
    background: transparent;
    border: 1px solid var(--iob-divider);
    border-radius: var(--iob-border-radius);
    padding: 0.1em 0.7em;
    cursor: pointer;
}
button.export:hover:not(:disabled) {
    background: color-mix(in srgb, currentColor 8%, transparent);
}
button.export:disabled {
    cursor: default;
    opacity: 0.5;
}
`,ue=`${le}${q}${J}
.tile {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: clamp(4px, 5cqmin, 12px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(2px, 3cqmin, 10px);
    overflow: hidden;
    text-align: center;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    outline: none;
    border-radius: calc(var(--iob-border-radius) * 2);
}
.tile.clickable {
    cursor: pointer;
}
.tile.clickable:hover {
    background: color-mix(in srgb, currentColor 6%, transparent);
}
.tile:focus-visible {
    box-shadow: inset 0 0 0 2px var(--iob-primary);
}
.tile.alarm {
    box-shadow: inset 0 0 0 2px var(--accent);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
}
.tile.alarm.clickable:hover {
    background: color-mix(in srgb, var(--accent) 16%, transparent);
}
.tile .icon {
    flex: none;
    width: clamp(16px, 18cqmin, 56px);
    height: clamp(16px, 18cqmin, 56px);
    object-fit: contain;
}
.tile .body {
    min-width: 0;
    max-width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(1px, 2cqmin, 6px);
}
.tile .name,
.tile .meta {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.tile .name {
    font-size: clamp(9px, 7cqmin, 14px);
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--iob-text-secondary);
}
.tile .text {
    max-width: 100%;
    font-size: clamp(11px, 11cqmin, 22px);
    font-weight: 700;
    line-height: 1.25;
    overflow: hidden;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}
.tile .value {
    font-size: clamp(12px, 14cqmin, 32px);
    font-weight: 700;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
}
.tile .meta {
    font-size: clamp(9px, 6.5cqmin, 13px);
    color: var(--iob-text-secondary);
}
.tile .chip {
    font-size: clamp(8px, 6cqmin, 12px);
}
.tile .none {
    font-size: clamp(10px, 8cqmin, 16px);
    font-style: italic;
    color: var(--iob-text-secondary);
}
.tile .ok {
    width: clamp(16px, 16cqmin, 44px);
    height: clamp(16px, 16cqmin, 44px);
    fill: var(--iob-success);
}
/* a wide box: the picture beside the text */
@container (min-aspect-ratio: 5 / 2) {
    .tile.with-icon {
        flex-direction: row;
        text-align: left;
    }
    .tile.with-icon .body {
        align-items: flex-start;
    }
}

.alarms {
    width: 100%;
    height: 100%;
}
.alarms > .panel {
    display: none;
}
.alarms.panel-only > .tile {
    display: none;
}
.alarms.panel-only > .panel {
    display: flex;
}
@container (min-width: 360px) and (min-height: 240px) {
    .alarms.auto > .tile {
        display: none;
    }
    .alarms.auto > .panel {
        display: flex;
    }
}
`,de=`
:host {
    display: block;
}
.dialog {
    box-sizing: border-box;
    width: 100%;
    color: var(--iob-text);
    font-family: var(--iob-font-family);
    font-size: var(--iob-font-size);
}
${q}${J}
.dialog .list,
.dialog .panel {
    height: auto;
    overflow: visible;
    font-size: inherit;
}
.dialog .section {
    flex: none !important;
    overflow: visible;
}
.dialog .title {
    padding-top: 0.8em;
}
.dialog th,
.dialog td {
    white-space: normal;
    overflow-wrap: anywhere;
}
`;function fe(t){let n=document.createElement(`div`);for(let[e,r]of Object.entries(x(t)))n.style.setProperty(e,r);let r=n.attachShadow({mode:`open`}),i=document.createElement(`style`);i.textContent=de;let a=document.createElement(`div`);return a.className=`dialog`,r.append(i,a),{element:n,root:e(a)}}var Y={en:{chooseInstance:`Choose an instance of the event list in the settings`,noInstance:`Instance not found`,header_time:`Time`,header_event:`Event`,header_value:`Value`,header_duration:`Duration`,no_events:`No events`,level_fatal:`Fatal`,level_alarm:`Alarm`,level_warning:`Warning`,level_info:`Info`,just_now:`just now`,minutes:`min`,hours:`h`,days:`d`,header_level:`Level`,header_state:`State`,header_since:`Since`,header_message:`Message`,header_count:`Count`,header_group:`Group`,no_messages:`No standing alarms`,tooltip_ack:`Click to acknowledge`,header_came:`Came at`,header_gone:`Gone at`,no_journal:`The journal is empty`,cycle_ACTIVE:`ACTIVE`,cycle_ACK:`ACK`,cycle_CLEARED:`CLEARED`,cycle_CLOSED:`CLOSED`,unacknowledged:`unacknowledged`,active:`active`,events:`Events`,standing_messages:`Standing alarms`,alarm_journal:`Alarm journal`,export_csv:`CSV`,sample_message:`Boiler pressure too high`,evl_alarms_title:`Alarms`,evl_open_alarms_hint:`Click to see the alarms`,evl_more_alarms:`and %s more`,evl_unacknowledged_count:`%s unacknowledged`},de:{chooseInstance:`Instanz der Ereignisliste in den Einstellungen wählen`,noInstance:`Instanz nicht gefunden`,header_time:`Zeit`,header_event:`Ereignis`,header_value:`Wert`,header_duration:`Dauer`,no_events:`Keine Ereignisse`,level_fatal:`Fatal`,level_alarm:`Alarm`,level_warning:`Warnung`,level_info:`Info`,just_now:`gerade eben`,minutes:`Min.`,hours:`Std.`,days:`T`,header_level:`Stufe`,header_state:`Zustand`,header_since:`Seit`,header_message:`Meldung`,header_count:`Anzahl`,header_group:`Gruppe`,no_messages:`Keine anstehenden Alarme`,tooltip_ack:`Zum Quittieren klicken`,header_came:`Gekommen um`,header_gone:`Gegangen um`,no_journal:`Das Journal ist leer`,cycle_ACTIVE:`AKTIV`,cycle_ACK:`QUITTIERT`,cycle_CLEARED:`GEGANGEN`,cycle_CLOSED:`ABGESCHLOSSEN`,unacknowledged:`unquittiert`,active:`aktiv`,events:`Ereignisse`,standing_messages:`Anstehende Alarme`,alarm_journal:`Alarmjournal`,export_csv:`CSV`,sample_message:`Kesseldruck zu hoch`,evl_alarms_title:`Alarme`,evl_open_alarms_hint:`Klicken, um die Alarme zu sehen`,evl_more_alarms:`und %s weitere`,evl_unacknowledged_count:`%s unquittiert`},ru:{chooseInstance:`Выберите экземпляр списка событий в настройках`,noInstance:`Экземпляр не найден`,header_time:`Время`,header_event:`Мероприятие`,header_value:`Значение`,header_duration:`Продолжительность`,no_events:`Нет событий`,level_fatal:`Фатально`,level_alarm:`Авария`,level_warning:`Предупреждение`,level_info:`Инфо`,just_now:`только что`,minutes:`мин.`,hours:`ч.`,days:`дн.`,header_level:`Уровень`,header_state:`Состояние`,header_since:`С`,header_message:`Сообщение`,header_count:`Кол-во`,header_group:`Группа`,no_messages:`Нет активных аварий`,tooltip_ack:`Нажмите, чтобы квитировать`,header_came:`Пришло в`,header_gone:`Ушло в`,no_journal:`Журнал пуст`,cycle_ACTIVE:`АКТИВНО`,cycle_ACK:`КВИТИРОВАНО`,cycle_CLEARED:`УШЛО`,cycle_CLOSED:`ЗАКРЫТО`,unacknowledged:`неквитировано`,active:`активные`,events:`События`,standing_messages:`Активные аварии`,alarm_journal:`Журнал аварий`,export_csv:`CSV`,sample_message:`Давление котла слишком высокое`,evl_alarms_title:`Аварии`,evl_open_alarms_hint:`Нажмите, чтобы увидеть аварии`,evl_more_alarms:`и ещё %s`,evl_unacknowledged_count:`%s неквитировано`},pt:{chooseInstance:`Escolha uma instância da lista de eventos nas configurações`,noInstance:`Instância não encontrada`,header_time:`Tempo`,header_event:`Evento`,header_value:`Valor`,header_duration:`Duração`,no_events:`Sem eventos`,level_fatal:`Fatal`,level_alarm:`Alarme`,level_warning:`Aviso`,level_info:`Info`,just_now:`agora mesmo`,minutes:`min`,hours:`h`,days:`d`,header_level:`Nível`,header_state:`Estado`,header_since:`Desde`,header_message:`Mensagem`,header_count:`Cont.`,header_group:`Grupo`,no_messages:`Sem alarmes ativos`,tooltip_ack:`Clique para confirmar`,header_came:`Chegou às`,header_gone:`Desapareceu às`,no_journal:`O diário está vazio`,cycle_ACTIVE:`ATIVO`,cycle_ACK:`CONFIRMADO`,cycle_CLEARED:`DESAPARECEU`,cycle_CLOSED:`FECHADO`,unacknowledged:`por confirmar`,active:`ativos`,events:`Eventos`,standing_messages:`Alarmes ativos`,alarm_journal:`Diário de alarmes`,export_csv:`CSV`,sample_message:`Pressão da caldeira demasiado alta`,evl_alarms_title:`Alarmes`,evl_open_alarms_hint:`Clique para ver os alarmes`,evl_more_alarms:`e mais %s`,evl_unacknowledged_count:`%s por confirmar`},nl:{chooseInstance:`Kies een instantie van de gebeurtenissenlijst in de instellingen`,noInstance:`Instantie niet gevonden`,header_time:`Tijd`,header_event:`Evenement`,header_value:`Waarde`,header_duration:`Looptijd`,no_events:`Geen gebeurtenissen`,level_fatal:`Fataal`,level_alarm:`Alarm`,level_warning:`Waarschuwing`,level_info:`Info`,just_now:`zojuist`,minutes:`min`,hours:`u`,days:`d`,header_level:`Niveau`,header_state:`Status`,header_since:`Sinds`,header_message:`Melding`,header_count:`Aantal`,header_group:`Groep`,no_messages:`Geen openstaande alarmen`,tooltip_ack:`Klik om te bevestigen`,header_came:`Gekomen om`,header_gone:`Gegaan om`,no_journal:`Het journaal is leeg`,cycle_ACTIVE:`ACTIEF`,cycle_ACK:`BEVESTIGD`,cycle_CLEARED:`GEGAAN`,cycle_CLOSED:`AFGESLOTEN`,unacknowledged:`onbevestigd`,active:`actief`,events:`Gebeurtenissen`,standing_messages:`Openstaande alarmen`,alarm_journal:`Alarmjournaal`,export_csv:`CSV`,sample_message:`Keteldruk te hoog`,evl_alarms_title:`Alarmen`,evl_open_alarms_hint:`Klik om de alarmen te zien`,evl_more_alarms:`en nog %s`,evl_unacknowledged_count:`%s onbevestigd`},fr:{chooseInstance:`Choisissez une instance de la liste des événements dans les paramètres`,noInstance:`Instance introuvable`,header_time:`Temps`,header_event:`un événement`,header_value:`Valeur`,header_duration:`Durée`,no_events:`Aucun événement`,level_fatal:`Fatal`,level_alarm:`Alarme`,level_warning:`Avertissement`,level_info:`Info`,just_now:`à l'instant`,minutes:`min`,hours:`h`,days:`j`,header_level:`Niveau`,header_state:`État`,header_since:`Depuis`,header_message:`Message`,header_count:`Nb`,header_group:`Groupe`,no_messages:`Aucune alarme présente`,tooltip_ack:`Cliquer pour acquitter`,header_came:`Apparu à`,header_gone:`Disparu à`,no_journal:`Le journal est vide`,cycle_ACTIVE:`ACTIVE`,cycle_ACK:`ACQUITTÉ`,cycle_CLEARED:`DISPARU`,cycle_CLOSED:`CLOS`,unacknowledged:`non acquittées`,active:`actives`,events:`Événements`,standing_messages:`Alarmes présentes`,alarm_journal:`Journal des alarmes`,export_csv:`CSV`,sample_message:`Pression de la chaudière trop élevée`,evl_alarms_title:`Alarmes`,evl_open_alarms_hint:`Cliquez pour voir les alarmes`,evl_more_alarms:`et %s de plus`,evl_unacknowledged_count:`%s non acquittées`},it:{chooseInstance:`Scegli un'istanza dell'elenco eventi nelle impostazioni`,noInstance:`Istanza non trovata`,header_time:`Tempo`,header_event:`Evento`,header_value:`Valore`,header_duration:`Durata`,no_events:`Nessun evento`,level_fatal:`Fatale`,level_alarm:`Allarme`,level_warning:`Avviso`,level_info:`Info`,just_now:`proprio ora`,minutes:`min`,hours:`h`,days:`g`,header_level:`Livello`,header_state:`Stato`,header_since:`Dal`,header_message:`Messaggio`,header_count:`N.`,header_group:`Gruppo`,no_messages:`Nessun allarme attivo`,tooltip_ack:`Fai clic per confermare`,header_came:`Arrivato alle`,header_gone:`Scomparso alle`,no_journal:`Il giornale è vuoto`,cycle_ACTIVE:`ATTIVO`,cycle_ACK:`CONFERMATO`,cycle_CLEARED:`SCOMPARSO`,cycle_CLOSED:`CHIUSO`,unacknowledged:`non confermati`,active:`attivi`,events:`Eventi`,standing_messages:`Allarmi attivi`,alarm_journal:`Giornale degli allarmi`,export_csv:`CSV`,sample_message:`Pressione della caldaia troppo alta`,evl_alarms_title:`Allarmi`,evl_open_alarms_hint:`Fai clic per vedere gli allarmi`,evl_more_alarms:`e altri %s`,evl_unacknowledged_count:`%s non confermati`},es:{chooseInstance:`Elija una instancia de la lista de eventos en la configuración`,noInstance:`Instancia no encontrada`,header_time:`Hora`,header_event:`Evento`,header_value:`Valor`,header_duration:`Duración`,no_events:`Sin eventos`,level_fatal:`Fatal`,level_alarm:`Alarma`,level_warning:`Advertencia`,level_info:`Info`,just_now:`ahora mismo`,minutes:`min`,hours:`h`,days:`d`,header_level:`Nivel`,header_state:`Estado`,header_since:`Desde`,header_message:`Mensaje`,header_count:`Cant.`,header_group:`Grupo`,no_messages:`No hay alarmas activas`,tooltip_ack:`Haga clic para confirmar`,header_came:`Llegó a las`,header_gone:`Desapareció a las`,no_journal:`El diario está vacío`,cycle_ACTIVE:`ACTIVA`,cycle_ACK:`CONFIRMADA`,cycle_CLEARED:`DESAPARECIDA`,cycle_CLOSED:`CERRADA`,unacknowledged:`sin confirmar`,active:`activas`,events:`Eventos`,standing_messages:`Alarmas activas`,alarm_journal:`Diario de alarmas`,export_csv:`CSV`,sample_message:`Presión de la caldera demasiado alta`,evl_alarms_title:`Alarmas`,evl_open_alarms_hint:`Haga clic para ver las alarmas`,evl_more_alarms:`y %s más`,evl_unacknowledged_count:`%s sin confirmar`},pl:{chooseInstance:`Wybierz instancję listy zdarzeń w ustawieniach`,noInstance:`Nie znaleziono instancji`,header_time:`Czas`,header_event:`Zdarzenie`,header_value:`Wartość`,header_duration:`Trwanie`,no_events:`Brak zdarzeń`,level_fatal:`Krytyczny`,level_alarm:`Alarm`,level_warning:`Ostrzeżenie`,level_info:`Info`,just_now:`przed chwilą`,minutes:`min`,hours:`godz.`,days:`dni`,header_level:`Poziom`,header_state:`Stan`,header_since:`Od`,header_message:`Komunikat`,header_count:`Liczba`,header_group:`Grupa`,no_messages:`Brak aktywnych alarmów`,tooltip_ack:`Kliknij, aby potwierdzić`,header_came:`Pojawiło się o`,header_gone:`Ustąpiło o`,no_journal:`Dziennik jest pusty`,cycle_ACTIVE:`AKTYWNY`,cycle_ACK:`POTWIERDZONY`,cycle_CLEARED:`USTĄPIŁ`,cycle_CLOSED:`ZAMKNIĘTY`,unacknowledged:`niepotwierdzone`,active:`aktywne`,events:`Zdarzenia`,standing_messages:`Aktywne alarmy`,alarm_journal:`Dziennik alarmów`,export_csv:`CSV`,sample_message:`Za wysokie ciśnienie kotła`,evl_alarms_title:`Alarmy`,evl_open_alarms_hint:`Kliknij, aby zobaczyć alarmy`,evl_more_alarms:`i jeszcze %s`,evl_unacknowledged_count:`%s niepotwierdzonych`},uk:{chooseInstance:`Виберіть екземпляр списку подій у налаштуваннях`,noInstance:`Екземпляр не знайдено`,header_time:`Час`,header_event:`Подія`,header_value:`Значення`,header_duration:`Тривалість`,no_events:`Немає подій`,level_fatal:`Фатально`,level_alarm:`Аварія`,level_warning:`Попередження`,level_info:`Інфо`,just_now:`щойно`,minutes:`хв.`,hours:`год.`,days:`дн.`,header_level:`Рівень`,header_state:`Стан`,header_since:`З`,header_message:`Повідомлення`,header_count:`К-сть`,header_group:`Група`,no_messages:`Немає активних аварій`,tooltip_ack:`Натисніть, щоб квитувати`,header_came:`Прийшло о`,header_gone:`Зникло о`,no_journal:`Журнал порожній`,cycle_ACTIVE:`АКТИВНО`,cycle_ACK:`КВИТОВАНО`,cycle_CLEARED:`ЗНИКЛО`,cycle_CLOSED:`ЗАКРИТО`,unacknowledged:`неквитовано`,active:`активні`,events:`Події`,standing_messages:`Активні аварії`,alarm_journal:`Журнал аварій`,export_csv:`CSV`,sample_message:`Тиск котла завеликий`,evl_alarms_title:`Аварії`,evl_open_alarms_hint:`Натисніть, щоб побачити аварії`,evl_more_alarms:`і ще %s`,evl_unacknowledged_count:`%s неквитовано`},"zh-cn":{chooseInstance:`请在设置中选择事件列表的实例`,noInstance:`未找到实例`,header_time:`时间`,header_event:`事件`,header_value:`值`,header_duration:`持续时间`,no_events:`没有事件`,level_fatal:`致命`,level_alarm:`报警`,level_warning:`警告`,level_info:`信息`,just_now:`刚刚`,minutes:`分`,hours:`小时`,days:`天`,header_level:`级别`,header_state:`状态`,header_since:`起始`,header_message:`消息`,header_count:`数量`,header_group:`分组`,no_messages:`没有存在的报警`,tooltip_ack:`点击以确认`,header_came:`到来时间`,header_gone:`消失时间`,no_journal:`日志为空`,cycle_ACTIVE:`活动`,cycle_ACK:`已确认`,cycle_CLEARED:`已消失`,cycle_CLOSED:`已结束`,unacknowledged:`未确认`,active:`活动中`,events:`事件`,standing_messages:`存在的报警`,alarm_journal:`报警日志`,export_csv:`CSV`,sample_message:`锅炉压力过高`,evl_alarms_title:`报警`,evl_open_alarms_hint:`点击查看报警`,evl_more_alarms:`另有 %s 条`,evl_unacknowledged_count:`%s 条未确认`}};function X(e){return t=>Y[e]?.[t]||Y.en?.[t]||t}var pe=`M3 13h2v-2H3zm0 4h2v-2H3zm0-8h2V7H3zm4 4h14v-2H7zm0 4h14v-2H7zM7 7v2h14V7z`,me=`M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8z`;function Z({text:e,editMode:t}){return/* @__PURE__ */ r(`div`,{className:`hint${t?` edit`:``}`,children:[/* @__PURE__ */ n(`svg`,{viewBox:`0 0 24 24`,"aria-hidden":`true`,children:/* @__PURE__ */ n(`path`,{d:pe})}),/* @__PURE__ */ n(`span`,{children:e})]})}function he({events:e,columns:i,word:a}){let o=e=>{let t=i.titles?.[e]?.trim();return t&&t!==`_`?t:a(`header_${e}`)};return/* @__PURE__ */ r(t,{children:[/* @__PURE__ */ r(`table`,{children:[/* @__PURE__ */ n(`thead`,{children:/* @__PURE__ */ r(`tr`,{children:[i.time?/* @__PURE__ */ n(`th`,{className:`c-time r`,children:o(`time`)}):null,/* @__PURE__ */ n(`th`,{children:o(`event`)}),i.value?/* @__PURE__ */ n(`th`,{className:`c-value r`,children:o(`value`)}):null,i.duration?/* @__PURE__ */ n(`th`,{className:`c-duration r`,children:o(`duration`)}):null]})}),/* @__PURE__ */ n(`tbody`,{children:(e||[]).map((e,t)=>/* @__PURE__ */ r(`tr`,{style:e._style,children:[i.time?/* @__PURE__ */ n(`td`,{className:`r num`,title:F(e._id),children:e.ts}):null,/* @__PURE__ */ n(`td`,{title:e.event,children:e.event}),i.value?/* @__PURE__ */ n(`td`,{className:`r`,children:G(e.val)}):null,i.duration?/* @__PURE__ */ n(`td`,{className:`r num`,children:e.duration||``}):null]},`${e._id}-${t}`))})]}),e&&!e.length?/* @__PURE__ */ n(`div`,{className:`empty`,children:a(`no_events`)}):null]})}function ge({messages:e,columns:t,now:i,onAck:a,word:o}){return e&&!e.length?/* @__PURE__ */ n(`div`,{className:`empty`,children:o(`no_messages`)}):/* @__PURE__ */ r(`table`,{children:[/* @__PURE__ */ n(`thead`,{children:/* @__PURE__ */ r(`tr`,{children:[/* @__PURE__ */ n(`th`,{className:`c-level`,children:o(`header_level`)}),/* @__PURE__ */ n(`th`,{className:`c-state m`,children:o(`header_state`)}),t.since?/* @__PURE__ */ n(`th`,{className:`c-since r`,children:o(`header_since`)}):null,/* @__PURE__ */ n(`th`,{children:o(`header_message`)}),t.value?/* @__PURE__ */ n(`th`,{className:`c-mvalue r`,children:o(`header_value`)}):null,t.count?/* @__PURE__ */ n(`th`,{className:`c-count r`,children:o(`header_count`)}):null,t.group?/* @__PURE__ */ n(`th`,{className:`c-group`,children:o(`header_group`)}):null]})}),/* @__PURE__ */ n(`tbody`,{children:(e||[]).map(e=>{let s=!!a&&e.ackable,c=[e.ackable?`unacked`:``,e.active?``:`gone`,s?`ackable`:``].filter(e=>e),l=U(e);return/* @__PURE__ */ r(`tr`,{className:c.join(` `)||void 0,title:s?o(`tooltip_ack`):void 0,onClick:s?()=>a(e):void 0,children:[/* @__PURE__ */ n(`td`,{children:/* @__PURE__ */ n(`span`,{className:`chip`,style:{backgroundColor:l},children:W(e,o)})}),/* @__PURE__ */ n(`td`,{className:`m code`,children:e.state}),t.since?/* @__PURE__ */ n(`td`,{className:`r num`,title:F(e.ts),children:ae(i-e.ts,e=>o(e))}):null,/* @__PURE__ */ n(`td`,{style:{color:l},title:e.text,children:e.text}),t.value?/* @__PURE__ */ n(`td`,{className:`r`,children:G(e.val,e.unit)}):null,t.count?/* @__PURE__ */ n(`td`,{className:`r num`,children:e.count>1?e.count:``}):null,t.group?/* @__PURE__ */ n(`td`,{children:e.group||``}):null]},e.id)})})]})}function _e({cycles:e,word:t}){return e.length?/* @__PURE__ */ r(`table`,{children:[/* @__PURE__ */ n(`thead`,{children:/* @__PURE__ */ r(`tr`,{children:[/* @__PURE__ */ n(`th`,{className:`c-came`,children:t(`header_came`)}),/* @__PURE__ */ n(`th`,{className:`c-level`,children:t(`header_level`)}),/* @__PURE__ */ n(`th`,{className:`c-cycle m`,children:t(`header_state`)}),/* @__PURE__ */ n(`th`,{children:t(`header_message`)}),/* @__PURE__ */ n(`th`,{className:`c-gone r`,children:t(`header_gone`)})]})}),/* @__PURE__ */ n(`tbody`,{children:e.map(e=>/* @__PURE__ */ r(`tr`,{className:e.state===`CLOSED`?`closed`:void 0,children:[/* @__PURE__ */ n(`td`,{className:`num`,children:new Date(e.activatedAt).toLocaleString()}),/* @__PURE__ */ n(`td`,{children:/* @__PURE__ */ n(`span`,{className:`chip`,style:{backgroundColor:P[e.level]||P.info},children:W(e,t)})}),/* @__PURE__ */ n(`td`,{className:`m`,children:t(`cycle_${e.state}`)}),/* @__PURE__ */ n(`td`,{title:e.text,children:e.text}),/* @__PURE__ */ n(`td`,{className:`r num`,children:e.clearedAt?new Date(e.clearedAt).toLocaleString():``})]},e.id))})]}):/* @__PURE__ */ n(`div`,{className:`empty`,children:t(`no_journal`)})}function Q({view:e,dialog:i,editMode:a,word:o}){let s=!!e.messages&&!!e.events,c=e.onExport?/* @__PURE__ */ n(`button`,{type:`button`,className:`export`,disabled:!e.journal?.length,onClick:e.onExport,children:o(`export_csv`)}):null;return/* @__PURE__ */ r(`div`,{className:`panel${a?` edit`:``}`,children:[e.summary?/* @__PURE__ */ n(`div`,{className:`summary`,children:[{label:o(`unacknowledged`),value:e.summary.unacknowledged,color:P.fatal},{label:o(`active`),value:e.summary.active,color:P.alarm},{label:o(`events`),value:e.summary.events,color:void 0}].map(e=>/* @__PURE__ */ r(`span`,{children:[/* @__PURE__ */ n(`span`,{className:`count`,style:{color:e.value?e.color:void 0},children:e.value}),/* @__PURE__ */ n(`span`,{className:`label`,children:e.label})]},e.label))}):null,e.messages?/* @__PURE__ */ r(t,{children:[e.titles?/* @__PURE__ */ n(`div`,{className:`title`,children:o(`standing_messages`)}):null,/* @__PURE__ */ n(`div`,{className:`section`,style:{flex:s&&!i?e.ratio:1},children:/* @__PURE__ */ n(`div`,{className:`list`,children:/* @__PURE__ */ n(ge,{messages:e.messages,columns:e.messageColumns,now:e.now,onAck:e.onAck,word:o})})})]}):null,e.events?/* @__PURE__ */ r(t,{children:[e.titles?/* @__PURE__ */ n(`div`,{className:`title`,children:o(`events`)}):null,/* @__PURE__ */ n(`div`,{className:`section`,style:{flex:s&&!i?100-e.ratio:1},children:/* @__PURE__ */ n(`div`,{className:`list`,children:/* @__PURE__ */ n(he,{events:e.events,columns:e.eventColumns,word:o})})})]}):null,e.journal?/* @__PURE__ */ r(t,{children:[e.titles||c?/* @__PURE__ */ r(`div`,{className:`title`,children:[/* @__PURE__ */ n(`span`,{children:e.titles?o(`alarm_journal`):``}),c]}):null,/* @__PURE__ */ n(`div`,{className:`section`,style:{flex:1},children:/* @__PURE__ */ n(`div`,{className:`list`,children:/* @__PURE__ */ n(_e,{cycles:e.journal,word:o})})})]}):null]})}function ve({icon:e,accent:t,hint:i,editMode:a,onOpen:o,children:s}){let c=!a,l=[`tile`];return c&&l.push(`clickable`),a&&l.push(`edit`),t&&l.push(`alarm`),e&&l.push(`with-icon`),/* @__PURE__ */ r(`div`,{className:l.join(` `),style:t?{"--accent":t}:void 0,role:c?`button`:void 0,tabIndex:c?0:void 0,title:c?i:void 0,onClick:c?o:void 0,onKeyDown:c?e=>{(e.key===`Enter`||e.key===` `)&&(e.preventDefault(),o())}:void 0,children:[e?/* @__PURE__ */ n(`img`,{className:`icon`,src:e,alt:``}):null,/* @__PURE__ */ n(`div`,{className:`body`,children:s})]})}function ye(){return/* @__PURE__ */ n(`svg`,{className:`ok`,viewBox:`0 0 24 24`,"aria-hidden":`true`,children:/* @__PURE__ */ n(`path`,{d:me})})}var be=`﻿`,xe=20;function $(e){let t=e.show||`both`,n=t===`both`||t===`messages`;return{messages:n,events:t===`both`||t===`events`,journal:t===`journal`||!!e.showJournal,summary:n&&e.showSummary!==!1}}var Se=class extends A{#e;#t=z();#n=R();#r=B();#i=null;#a=null;#o=null;constructor(){super();let t=this.attachShadow({mode:`open`}),n=document.createElement(`style`);n.textContent=ue;let r=document.createElement(`div`);r.className=`mount`,t.append(n,r),this.#e=e(r)}connectedCallback(){super.connectedCallback(),this.#o||=setInterval(()=>this.render(),se)}disconnectedCallback(){super.disconnectedCallback(),this.#o&&=(clearInterval(this.#o),null)}getStateIds(e){let t=M(e.instance);if(!t)return[];let n=$(e),r=[`${t}.messages.list`];return(n.events||n.summary)&&r.push(`${t}.eventJSONList`),n.journal&&r.push(`${t}.messages.journal`),r}#s(e){let t=this.#t.get(this.states[`${e}.messages.list`]),n=this.settings.filterLevel;return t&&n?t.filter(e=>e.level===n):t}#c(e){let t=this.socket;if(!t||this.#i?.namespace===e)return;let n={namespace:e,cycles:null};this.#i=n,t.sendTo(e,`journal`,{archive:!0}).then(e=>{n.cycles=Array.isArray(e)?e:[],this.#i===n&&this.isConnected&&this.render()}).catch(e=>console.warn(`<${this.localName}>: cannot read the alarm archive: ${String(e)}`))}#l(e){let t=this.#r.get(this.states[`${e}.messages.journal`])||[],n=this.settings.journalArchive&&this.#i?.namespace===e&&this.#i.cycles;if(!n||!n.length)return t;let r=/* @__PURE__ */ new Map;for(let e of[...n,...t])r.set(e.id,e);return[...r.values()].sort((e,t)=>e.activatedAt-t.activatedAt)}#u(e,t){this.settings.allowAck&&t.ackable&&!this.editMode&&this.setState(`${e}.messages.ack`,t.id).catch(e=>console.warn(`<${this.localName}>: cannot acknowledge ${t.id}: ${String(e)}`))}#d(e,t){this.socket&&!this.editMode&&this.socket.sendTo(e,`journalCsv`,{archive:!!this.settings.journalArchive,ids:t.map(e=>e.id)}).then(e=>{e?.csv&&ce(`${be}${e.csv}`,e.fileName||`alarm-journal.csv`,`text/csv;charset=utf-8`)}).catch(e=>console.warn(`<${this.localName}>: cannot export the alarm journal: ${String(e)}`))}#f(e,t){let n=this.settings,r=$(n),i=this.editMode,a=this.#s(e);i&&!a?.length&&(a=H(t));let o=this.#n.get(this.states[`${e}.eventJSONList`]),s=o&&V(o,ne(n.filterById)),c=r.journal?this.#l(e):[],l=N([...c].reverse(),n.maxJournal===void 0?xe:n.maxJournal);return{messages:r.messages?a&&N(a,n.maxMessages):null,messageColumns:{since:n.showSince!==!1,value:n.showMessageValue!==!1,count:!!n.showCount,group:!!n.showGroup},events:r.events?s&&N(s,n.maxEvents):null,eventColumns:{time:n.showTime!==!1,value:n.showValue!==!1,duration:!!n.showDuration},journal:r.journal?l:null,summary:r.summary?{unacknowledged:(a||[]).filter(e=>e.ackable).length,active:(a||[]).filter(e=>e.active).length,events:(s||[]).length}:null,ratio:Math.min(90,Math.max(10,n.messagesRatio||50)),titles:n.showTitles!==!1,onExport:r.journal&&n.allowExport&&!i?()=>this.#d(e,c):null,onAck:n.allowAck&&!i?t=>this.#u(e,t):void 0,now:Date.now()}}#p=()=>{let e=M(this.settings.instance);e&&!this.editMode&&!this.#a&&this.#m(e)};async#m(e){let t=X(this.systemLang),{element:r,root:i}=fe(this.theme);this.#a=()=>i.render(/* @__PURE__ */ n(Q,{view:this.#f(e,t),dialog:!0,word:t})),this.#a();try{await this.openDialog({title:this.settings.name||t(`evl_alarms_title`),element:r,width:900})}finally{this.#a=null,i.unmount()}}#h(e,i){let a=this.settings,o=this.#s(e);this.editMode&&!o?.length&&(o=H(i));let s=o?.[0],c=s?U(s):void 0,l=(o||[]).filter(e=>e.ackable).length,u=(o||[]).length,d=s&&a.showMessageValue!==!1?G(s.val,s.unit):``,f=[l?i(`evl_unacknowledged_count`).replace(`%s`,l.toString()):``,u>1?i(`evl_more_alarms`).replace(`%s`,(u-1).toString()):``].filter(e=>e).join(` · `);return/* @__PURE__ */ r(ve,{icon:K(s?.icon),accent:c,hint:i(`evl_open_alarms_hint`),editMode:this.editMode,onOpen:this.#p,children:[a.name?/* @__PURE__ */ n(`div`,{className:`name`,children:a.name}):null,s?/* @__PURE__ */ r(t,{children:[/* @__PURE__ */ n(`span`,{className:`chip`,style:{backgroundColor:c},children:W(s,i)}),/* @__PURE__ */ n(`div`,{className:`text`,style:{color:c},title:s.text,children:s.text}),d?/* @__PURE__ */ n(`div`,{className:`value`,style:{color:c},children:d}):null,f?/* @__PURE__ */ n(`div`,{className:`meta`,children:f}):null]}):null,o&&!s?/* @__PURE__ */ r(t,{children:[/* @__PURE__ */ n(ye,{}),/* @__PURE__ */ n(`div`,{className:`none`,children:i(`no_messages`)})]}):null]})}render(){let e=this.settings,t=X(this.systemLang),i=M(e.instance);if(!i){this.#e.render(/* @__PURE__ */ n(Z,{text:e.instance?`${t(`noInstance`)}: ${e.instance}`:t(`chooseInstance`),editMode:this.editMode}));return}if(this.objects[`${i}.messages.list`]===null){this.#e.render(/* @__PURE__ */ n(Z,{text:`${t(`noInstance`)}: ${i}`,editMode:this.editMode}));return}$(e).journal&&e.journalArchive&&this.#c(i);let a=e.layout||`auto`,o=`alarms auto`;a===`tile`?o=`alarms tile-only`:a===`panel`&&(o=`alarms panel-only`),this.#e.render(/* @__PURE__ */ r(`div`,{className:o,children:[a===`panel`?null:this.#h(i,t),a===`tile`?null:/* @__PURE__ */ n(Q,{view:this.#f(i,t),editMode:this.editMode,word:t})]})),this.#a?.()}};te(j(`eventlist-alarms`),Se);