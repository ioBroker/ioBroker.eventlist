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
`;function w(e){if(!e)return null;try{let t=Function(`data`,`return (${e});`);return e=>{try{return!!t(e)}catch{return!1}}}catch{return null}}function T(e){return typeof e==`string`?e:typeof e==`number`||typeof e==`boolean`?String(e):``}function E(e){let{input:t,setting:n}=e;if(t)return t instanceof HTMLInputElement&&t.type===`checkbox`?t.checked:t instanceof HTMLSelectElement?n.options?.[t.selectedIndex]?.value:t.value}function D(e,t,n,r,i){let a={name:t,setting:n,box:e.createElement(`div`),hidden:w(n.hidden),disabled:w(n.disabled)},o=s(n.label,i);switch(n.type){case`header`:return a.box=e.createElement(`h3`),a.box.textContent=s(n.text,i)||o,a;case`staticText`:return a.box=e.createElement(`p`),a.box.textContent=s(n.text,i)||o,a;case`divider`:return a.box=e.createElement(`hr`),a}let c=e.createElement(`label`);a.box=c;let l=e.createElement(`span`);if(l.textContent=o||t,n.type===`checkbox`){let t=e.createElement(`input`);t.type=`checkbox`,t.checked=r===!0||r===`true`,c.className=`check`,c.append(t,l),a.input=t}else if(n.type===`select`){let t=e.createElement(`select`);for(let r of n.options||[]){let n=e.createElement(`option`);n.textContent=s(r.label,i),t.append(n)}let o=(n.options||[]).findIndex(e=>String(e.value)===T(r));t.selectedIndex=o===-1?0:o,c.append(l,t),a.input=t}else if(n.type===`text`&&(n.minRows||1)>1){let t=e.createElement(`textarea`);t.rows=n.minRows||2,t.value=T(r),c.append(l,t),a.input=t}else{let t=e.createElement(`input`),i=T(r);switch(n.type){case`number`:case`slider`:t.type=n.type===`slider`?`range`:`number`,n.min!==void 0&&(t.min=String(n.min)),n.max!==void 0&&(t.max=String(n.max)),t.step=n.step===void 0?`any`:String(n.step);break;case`password`:t.type=`password`;break;case`color`:t.type=!i||/^#[0-9a-f]{6}$/i.test(i)?`color`:`text`;break;default:t.type=`text`}if(t.value=i,t.type===`range`){let n=e.createElement(`output`);n.textContent=t.value,t.addEventListener(`input`,()=>n.textContent=t.value),l.append(`: `,n)}c.append(l,t),a.input=t}if(n.help){let t=e.createElement(`span`);t.className=`help`,t.textContent=s(n.help,i),c.append(t)}return a}function O(e,t={}){let n=t.lang||`en`,r=document,o=e=>S[e][n]||S[e].en||e,l=r.createElement(`div`);l.setAttribute(`data-iob-dialog`,``);let u=l.attachShadow({mode:`open`}),f=r.createElement(`style`);f.textContent=C;let p=r.createElement(`dialog`),m=v(t.theme);p.className=m.type===`dark`?`dark`:``;for(let[e,t]of Object.entries(x(m)))p.style.setProperty(e,t);e.width&&(p.style.width=`${e.width}px`),e.height&&(p.style.height=`${e.height}px`);let h=r.createElement(`form`),g=r.createElement(`header`),_=r.createElement(`span`);_.textContent=s(e.title,n);let y=r.createElement(`button`);y.type=`button`,y.className=`close`,y.title=o(`close`),y.setAttribute(`aria-label`,o(`close`)),y.textContent=`×`,g.append(_,y);let b=r.createElement(`div`);return b.className=`body`,h.append(g,b),p.append(h),u.append(f,p),new Promise(t=>{let f=!1,m=e=>{f||(f=!0,p.open&&p.close(),l.remove(),t(e))};if(y.addEventListener(`click`,()=>m(null)),p.addEventListener(`close`,()=>m(null)),h.addEventListener(`submit`,e=>e.preventDefault()),a(e)){let t={},i=[];for(let[t,a]of Object.entries(e.form.items||{})){let o=e.data?.[t]??a.default,s=D(r,t,a,o,n);i.push(s),b.append(s.box)}let a=()=>{for(let e of i)e.input&&(t[e.name]=E(e));return t},l=()=>{let e=a();for(let t of i)t.box.hidden=t.hidden?t.hidden(e):!1,t.input&&(t.input.disabled=t.disabled?t.disabled(e):!1)};h.addEventListener(`input`,l),h.addEventListener(`change`,l),l();let u=i.find(e=>e.input&&!e.box.hidden&&!e.input.disabled);u?.input&&(u.input.autofocus=!0);let f=r.createElement(`footer`),p=r.createElement(`button`);p.type=`button`,p.textContent=s(e.cancel,n)||o(`cancel`),p.addEventListener(`click`,()=>m(null));let g=r.createElement(`button`);g.type=`submit`,g.className=`primary`,g.textContent=s(e.ok,n)||o(`ok`),f.append(p,g),h.append(f),h.addEventListener(`submit`,()=>m(d(c(e.form),a())))}else b.append(e.element),p.addEventListener(i,e=>m(e.detail??null));r.body.append(l),p.showModal(),u.activeElement&&u.activeElement!==y||(p.tabIndex=-1,p.focus())})}function k(e){return[...new Set(e.filter(e=>typeof e==`string`&&!!e))]}var A=[`socket`,`dialogs`,`theme`,`editMode`,`settings`,`value`],j=class extends HTMLElement{states={};objects={};#e=null;#t={};#n=v(`light`);#r=!1;#i=null;#a=void 0;#o=null;#s=!1;#c=(e,t)=>{this.#o?.states.includes(e)&&(this.states[e]=t||null,this.#_())};#l=(e,t)=>{this.#o?.objects.includes(e)&&(this.objects[e]=t||null,this.#d())};get socket(){return this.#e}set socket(e){this.#e=e||null,this.#d()}get settings(){return this.#t}set settings(e){this.#t=e||{},this.#d()}get theme(){return this.#n}set theme(e){let t=v(e);y(t,this.#n)||(this.#n=t,this.#u(),this.#_())}get editMode(){return this.#r}set editMode(e){let t=!!e;t!==this.#r&&(this.#r=t,this.#_())}get dialogs(){return this.#i}set dialogs(e){this.#i=e||null}get value(){return this.#a}set value(e){e!==this.#a&&(this.#a=e,this.#_())}connectedCallback(){for(let e of A)if(Object.prototype.hasOwnProperty.call(this,e)){let t=this[e];delete this[e],this[e]=t}this.#u(),this.#d()}disconnectedCallback(){this.#g()}getStateIds(e){return[]}getObjectIds(e){return[]}get systemLang(){return this.#e?.systemLang||`en`}text(e){return s(e,this.systemLang)}setState(e,t){return this.#e&&!this.#r?this.#e.setState(e,t):Promise.resolve()}changeValue(e){return this.#r||this.emit(`iob-change`,e)?!1:(this.value=e,!0)}emit(e,t){return this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0,cancelable:!0}))}async openDialog(e){if(this.#r)return null;let t=this.#i?await this.#i.open(e):await O(e,{lang:this.systemLang,theme:this.#n});return a(e)?t&&typeof t==`object`?d(c(e.form),t):null:t??null}#u(){for(let[e,t]of Object.entries(x(this.#n)))this.style.setProperty(e,t)}#d(){if(!this.isConnected)return;let e=this.#e,t=e?k(this.getStateIds(this.#t)):[],n=e?k(this.getObjectIds(this.#t)):[];this.#o&&this.#o.socket!==e&&this.#g();let r=this.#o?.states||[],i=this.#o?.objects||[],a=r.filter(e=>!t.includes(e)),o=i.filter(e=>!n.includes(e)),s=t.filter(e=>!r.includes(e)),c=n.filter(e=>!i.includes(e));e&&a.length&&e.unsubscribeState(a,this.#c),e&&o.length&&this.#h(e,o);for(let e of a)delete this.states[e];for(let e of[...a,...o])!t.includes(e)&&!n.includes(e)&&delete this.objects[e];this.#o=e&&(t.length||n.length)?{socket:e,states:t,objects:n}:null,e&&s.length&&this.#p(e,s),e&&c.length&&this.#m(e,c),this.#_()}#f(e,t,n){return this.#o?.socket===e&&this.#o[t].includes(n)}#p(e,t){e.subscribeState(t,this.#c).catch(e=>console.warn(`<${this.localName}>: cannot subscribe ${t.join(`, `)}: ${e}`));for(let n of t)e.getState(n).then(t=>{this.#f(e,`states`,n)&&this.states[n]===void 0&&(this.states[n]=t||null,this.#_())}).catch(()=>{}),e.getObject(n).then(t=>{this.#f(e,`states`,n)&&!this.#f(e,`objects`,n)&&(this.objects[n]=t||null,this.#_())}).catch(()=>{})}#m(e,t){e.subscribeObject(t,this.#l).catch(e=>console.warn(`<${this.localName}>: cannot subscribe the objects ${t.join(`, `)}: ${e}`));for(let n of t)e.getObject(n).then(t=>{this.#f(e,`objects`,n)&&(this.objects[n]=t||null,this.#d())}).catch(()=>{})}#h(e,t){e.unsubscribeObject(t,this.#l).catch(()=>{})}#g(){if(this.#o){let{socket:e,states:t,objects:n}=this.#o;t.length&&e.unsubscribeState(t,this.#c),n.length&&this.#h(e,n),this.#o=null}this.states={},this.objects={}}#_(){this.#s||(this.#s=!0,queueMicrotask(()=>{this.#s=!1,this.isConnected&&this.render()}))}};function ee(e,t){let n=typeof e==`string`?e:e.tag;customElements.get(n)||customElements.define(n,t)}function M(e){return`iob-${e}`}function N(e){let t=(e||``).trim().match(/^(?:eventlist\.)?(\d+)$/);return t?`eventlist.${t[1]}`:null}function P(e){let t=(e||``).split(`,`).map(e=>e.trim()).filter(e=>e);return t.length?t:null}function F(e,t){return t&&t>0?e.slice(0,t):e}function I(e){if(!e)return[];if(Array.isArray(e))return e;if(typeof e==`string`)try{let t=JSON.parse(e);return Array.isArray(t)?t:[]}catch{return console.warn(`Cannot parse event list: "${e}"`),[]}return[]}function L(e){return e?new Date(e).toLocaleString():void 0}function R(){return new URL(
/* @vite-ignore */
`../../../`,import.meta.url)}var z=class{#e;#t;#n=[];constructor(e){this.#e=e}get(e){return e===void 0?null:(e!==this.#t&&(this.#t=e,this.#n=this.#e(e?.val)),this.#n)}};function B(){return new z(I)}function V(e,t){return t?e.filter(e=>t.includes(e.id||``)):e}function H(e){let t=Date.now();return[{_id:t,ts:new Date(t).toLocaleTimeString(),event:e(`sample_event`),val:`5°C`,duration:`1h 2s`}]}function U(e,t){return e==null?``:`${e.toString()}${t||``}`}function W(e){if(!e||e.endsWith(`default`))return null;if(/^(data:image\/|https?:\/\/)/.test(e))return e;let t=e.match(/^\/?([a-z0-9_-]+)\.admin\/(.+)$/i);return t?new URL(`adapter/${t[1]}/${t[2]}`,R()).href:null}var G=`
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
`,K=`
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
`,q=`
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
`,J=`${G}
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
`,Y=`
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
${K}${q}
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
`;function X(t){let n=document.createElement(`div`);for(let[e,r]of Object.entries(x(t)))n.style.setProperty(e,r);let r=n.attachShadow({mode:`open`}),i=document.createElement(`style`);i.textContent=Y;let a=document.createElement(`div`);return a.className=`dialog`,r.append(i,a),{element:n,root:e(a)}}var Z={en:{chooseInstance:`Choose an instance of the event list in the settings`,noInstance:`Instance not found`,header_time:`Time`,header_event:`Event`,header_value:`Value`,header_duration:`Duration`,no_events:`No events`,sample_event:`Temperature outside changed to`,evl_title:`Event list`,evl_open_hint:`Click to see all events`},de:{chooseInstance:`Instanz der Ereignisliste in den Einstellungen wählen`,noInstance:`Instanz nicht gefunden`,header_time:`Zeit`,header_event:`Ereignis`,header_value:`Wert`,header_duration:`Dauer`,no_events:`Keine Ereignisse`,sample_event:`Außentemperatur auf geändert`,evl_title:`Ereignisliste`,evl_open_hint:`Klicken, um alle Ereignisse zu sehen`},ru:{chooseInstance:`Выберите экземпляр списка событий в настройках`,noInstance:`Экземпляр не найден`,header_time:`Время`,header_event:`Мероприятие`,header_value:`Значение`,header_duration:`Продолжительность`,no_events:`Нет событий`,sample_event:`Температура снаружи изменилась на`,evl_title:`Список событий`,evl_open_hint:`Нажмите, чтобы увидеть все события`},pt:{chooseInstance:`Escolha uma instância da lista de eventos nas configurações`,noInstance:`Instância não encontrada`,header_time:`Tempo`,header_event:`Evento`,header_value:`Valor`,header_duration:`Duração`,no_events:`Sem eventos`,sample_event:`A temperatura externa mudou para`,evl_title:`Lista de evento`,evl_open_hint:`Clique para ver todos os eventos`},nl:{chooseInstance:`Kies een instantie van de gebeurtenissenlijst in de instellingen`,noInstance:`Instantie niet gevonden`,header_time:`Tijd`,header_event:`Evenement`,header_value:`Waarde`,header_duration:`Looptijd`,no_events:`Geen gebeurtenissen`,sample_event:`Temperatuur buiten veranderd naar`,evl_title:`Evenementenlijst`,evl_open_hint:`Klik om alle gebeurtenissen te zien`},fr:{chooseInstance:`Choisissez une instance de la liste des événements dans les paramètres`,noInstance:`Instance introuvable`,header_time:`Temps`,header_event:`un événement`,header_value:`Valeur`,header_duration:`Durée`,no_events:`Aucun événement`,sample_event:`Température extérieure modifiée à`,evl_title:`Liste des événements`,evl_open_hint:`Cliquez pour voir tous les événements`},it:{chooseInstance:`Scegli un'istanza dell'elenco eventi nelle impostazioni`,noInstance:`Istanza non trovata`,header_time:`Tempo`,header_event:`Evento`,header_value:`Valore`,header_duration:`Durata`,no_events:`Nessun evento`,sample_event:`La temperatura esterna è cambiata a`,evl_title:`Elenco degli eventi`,evl_open_hint:`Fai clic per vedere tutti gli eventi`},es:{chooseInstance:`Elija una instancia de la lista de eventos en la configuración`,noInstance:`Instancia no encontrada`,header_time:`Hora`,header_event:`Evento`,header_value:`Valor`,header_duration:`Duración`,no_events:`Sin eventos`,sample_event:`La temperatura exterior cambió a`,evl_title:`Lista de eventos`,evl_open_hint:`Haga clic para ver todos los eventos`},pl:{chooseInstance:`Wybierz instancję listy zdarzeń w ustawieniach`,noInstance:`Nie znaleziono instancji`,header_time:`Czas`,header_event:`Zdarzenie`,header_value:`Wartość`,header_duration:`Trwanie`,no_events:`Brak zdarzeń`,sample_event:`Temperatura na zewnątrz zmieniona na`,evl_title:`Lista wydarzeń`,evl_open_hint:`Kliknij, aby zobaczyć wszystkie zdarzenia`},uk:{chooseInstance:`Виберіть екземпляр списку подій у налаштуваннях`,noInstance:`Екземпляр не знайдено`,header_time:`Час`,header_event:`Подія`,header_value:`Значення`,header_duration:`Тривалість`,no_events:`Немає подій`,sample_event:`Температура надворі змінилася на`,evl_title:`Список подій`,evl_open_hint:`Натисніть, щоб побачити всі події`},"zh-cn":{chooseInstance:`请在设置中选择事件列表的实例`,noInstance:`未找到实例`,header_time:`时间`,header_event:`事件`,header_value:`值`,header_duration:`持续时间`,no_events:`没有事件`,sample_event:`外界温度更改为`,evl_title:`活动列表`,evl_open_hint:`点击查看所有事件`}};function Q(e){return t=>Z[e]?.[t]||Z.en?.[t]||t}var te=`M3 13h2v-2H3zm0 4h2v-2H3zm0-8h2V7H3zm4 4h14v-2H7zm0 4h14v-2H7zM7 7v2h14V7z`;function $({text:e,editMode:t}){return/* @__PURE__ */ r(`div`,{className:`hint${t?` edit`:``}`,children:[/* @__PURE__ */ n(`svg`,{viewBox:`0 0 24 24`,"aria-hidden":`true`,children:/* @__PURE__ */ n(`path`,{d:te})}),/* @__PURE__ */ n(`span`,{children:e})]})}function ne({events:e,columns:i,word:a}){let o=e=>{let t=i.titles?.[e]?.trim();return t&&t!==`_`?t:a(`header_${e}`)};return/* @__PURE__ */ r(t,{children:[/* @__PURE__ */ r(`table`,{children:[/* @__PURE__ */ n(`thead`,{children:/* @__PURE__ */ r(`tr`,{children:[i.time?/* @__PURE__ */ n(`th`,{className:`c-time r`,children:o(`time`)}):null,/* @__PURE__ */ n(`th`,{children:o(`event`)}),i.value?/* @__PURE__ */ n(`th`,{className:`c-value r`,children:o(`value`)}):null,i.duration?/* @__PURE__ */ n(`th`,{className:`c-duration r`,children:o(`duration`)}):null]})}),/* @__PURE__ */ n(`tbody`,{children:(e||[]).map((e,t)=>/* @__PURE__ */ r(`tr`,{style:e._style,children:[i.time?/* @__PURE__ */ n(`td`,{className:`r num`,title:L(e._id),children:e.ts}):null,/* @__PURE__ */ n(`td`,{title:e.event,children:e.event}),i.value?/* @__PURE__ */ n(`td`,{className:`r`,children:U(e.val)}):null,i.duration?/* @__PURE__ */ n(`td`,{className:`r num`,children:e.duration||``}):null]},`${e._id}-${t}`))})]}),e&&!e.length?/* @__PURE__ */ n(`div`,{className:`empty`,children:a(`no_events`)}):null]})}function re({icon:e,accent:t,hint:i,editMode:a,onOpen:o,children:s}){let c=!a,l=[`tile`];return c&&l.push(`clickable`),a&&l.push(`edit`),t&&l.push(`alarm`),e&&l.push(`with-icon`),/* @__PURE__ */ r(`div`,{className:l.join(` `),style:t?{"--accent":t}:void 0,role:c?`button`:void 0,tabIndex:c?0:void 0,title:c?i:void 0,onClick:c?o:void 0,onKeyDown:c?e=>{(e.key===`Enter`||e.key===` `)&&(e.preventDefault(),o())}:void 0,children:[e?/* @__PURE__ */ n(`img`,{className:`icon`,src:e,alt:``}):null,/* @__PURE__ */ n(`div`,{className:`body`,children:s})]})}var ie=30,ae=class extends j{#e;#t=B();#n=null;constructor(){super();let t=this.attachShadow({mode:`open`}),n=document.createElement(`style`);n.textContent=J;let r=document.createElement(`div`);r.className=`mount`,t.append(n,r),this.#e=e(r)}getStateIds(e){let t=N(e.instance);return t?[`${t}.eventJSONList`]:[]}#r(e){let t=this.#t.get(this.states[`${e}.eventJSONList`]);return t&&V(t,P(this.settings.filter))}#i=()=>{let e=N(this.settings.instance);e&&!this.editMode&&!this.#n&&this.#a(e)};async#a(e){let t=Q(this.systemLang),{element:r,root:i}=X(this.theme);this.#n=()=>{let r=this.settings,a=this.#r(e);i.render(/* @__PURE__ */ n(`div`,{className:`list`,children:/* @__PURE__ */ n(ne,{events:a&&F(a,r.maxRows??ie),columns:{time:!0,value:r.showValue!==!1,duration:r.showDuration===!0},word:t})}))},this.#n();try{await this.openDialog({title:this.settings.name||t(`evl_title`),element:r,width:800})}finally{this.#n=null,i.unmount()}}render(){let e=this.settings,i=Q(this.systemLang),a=N(e.instance);if(!a){this.#e.render(/* @__PURE__ */ n($,{text:e.instance?`${i(`noInstance`)}: ${e.instance}`:i(`chooseInstance`),editMode:this.editMode}));return}if(this.objects[`${a}.eventJSONList`]===null){this.#e.render(/* @__PURE__ */ n($,{text:`${i(`noInstance`)}: ${a}`,editMode:this.editMode}));return}let o=this.#r(a);this.editMode&&!o?.length&&(o=H(i));let s=o?.[0],c=s?._style?.color;this.#e.render(/* @__PURE__ */ r(re,{icon:W(s?.icon),hint:i(`evl_open_hint`),editMode:this.editMode,onOpen:this.#i,children:[e.name?/* @__PURE__ */ n(`div`,{className:`name`,children:e.name}):null,s?/* @__PURE__ */ r(t,{children:[/* @__PURE__ */ n(`div`,{className:`text`,style:{color:c},title:s.event,children:s.event}),e.showValue!==!1&&U(s.val)?/* @__PURE__ */ n(`div`,{className:`value`,style:{color:c},children:U(s.val)}):null,/* @__PURE__ */ n(`div`,{className:`meta`,title:L(s._id),children:s.ts})]}):null,o&&!s?/* @__PURE__ */ n(`div`,{className:`none`,children:i(`no_events`)}):null]})),this.#n?.()}};ee(M(`eventlist-last-event`),ae);