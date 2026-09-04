// GENERATED FILE - do not edit.
// Source: src-blockly/blockly.ts - rebuild with `npm run build:blockly`.
"use strict";
(() => {
  // src-blockly/helpers.ts
  var Blockly = window.Blockly;
  function instanceOptions() {
    const options = [];
    const instances = window.main?.instances;
    if (instances) {
      for (const id of instances) {
        const m = id.match(/^system\.adapter\.eventlist\.(\d+)$/);
        if (m) {
          const n = parseInt(m[1], 10);
          options.push([`eventlist.${n}`, `.${n}`]);
        }
      }
    }
    if (!options.length) {
      for (let n = 0; n <= 4; n++) {
        options.push([`eventlist.${n}`, `.${n}`]);
      }
    }
    return options;
  }
  function logLevelOptions() {
    return [
      [Blockly.Translate("eventlist_log_none"), ""],
      [Blockly.Translate("eventlist_log_debug"), "debug"],
      [Blockly.Translate("eventlist_log_info"), "log"],
      [Blockly.Translate("eventlist_log_warn"), "warn"],
      [Blockly.Translate("eventlist_log_error"), "error"]
    ];
  }
  function logLine(logLevel, prefix, text) {
    if (!logLevel) {
      return "";
    }
    return `console.${logLevel}('${prefix}: '${text ? ` + ${text}` : ""});
`;
  }
  function makeOptional(block, name) {
    const connection = block.getInput(name)?.connection;
    if (connection) {
      connection._optional = true;
    }
  }
  function registerGenerator(type, generator) {
    if (Blockly.JavaScript.forBlock) {
      Blockly.JavaScript.forBlock[type] = generator;
    } else {
      Blockly.JavaScript[type] = generator;
    }
  }

  // src-blockly/blocks/delete.ts
  var Blockly2 = window.Blockly;
  var ALL = "all";
  function installDelete() {
    Blockly2.Sendto.blocks.eventlist_delete = `<block type="eventlist_delete">
  <field name="INSTANCE"></field>
  <field name="WHAT">${ALL}</field>
  <field name="LOG"></field>
</block>`;
    Blockly2.Blocks.eventlist_delete = {
      init: function() {
        this.appendDummyInput("INSTANCE").appendField(Blockly2.Translate("eventlist_delete")).appendField(new Blockly2.FieldDropdown(instanceOptions()), "INSTANCE");
        this.appendDummyInput("WHAT").appendField(Blockly2.Translate("eventlist_delete_what")).appendField(
          new Blockly2.FieldDropdown([
            [Blockly2.Translate("eventlist_delete_all"), ALL],
            [Blockly2.Translate("eventlist_delete_filter"), "filter"]
          ]),
          "WHAT"
        );
        this.appendValueInput("FILTER").appendField(Blockly2.Translate("eventlist_delete_filter"));
        makeOptional(this, "FILTER");
        this.appendDummyInput("LOG").appendField(Blockly2.Translate("eventlist_log")).appendField(new Blockly2.FieldDropdown(logLevelOptions()), "LOG");
        this.setInputsInline(false);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(Blockly2.Sendto.HUE);
        this.setTooltip(Blockly2.Translate("eventlist_delete_tooltip"));
        this.setHelpUrl(Blockly2.Translate("eventlist_help"));
      }
    };
    registerGenerator("eventlist_delete", (block) => {
      const instance = block.getFieldValue("INSTANCE");
      const what = block.getFieldValue("WHAT");
      const logLevel = block.getFieldValue("LOG");
      const filter = Blockly2.JavaScript.valueToCode(block, "FILTER", Blockly2.JavaScript.ORDER_ATOMIC);
      if (what !== ALL && !filter) {
        return "// eventlist: no state ID or time given, nothing deleted\n";
      }
      const target = what === ALL ? `'*'` : filter;
      const callback = logLevel ? `, result => console.${logLevel}('eventlist: deleted ' + result.deleted)` : "";
      return `sendTo('eventlist${instance}', 'delete', ${target}${callback});
`;
    });
  }

  // src-blockly/blocks/insert.ts
  var Blockly3 = window.Blockly;
  function installInsert() {
    Blockly3.Sendto.blocks.eventlist = `<block type="eventlist">
  <field name="INSTANCE"></field>
  <field name="LOG"></field>
  <value name="EVENT">
    <shadow type="text">
      <field name="TEXT">My custom event</field>
    </shadow>
  </value>
</block>`;
    Blockly3.Blocks.eventlist = {
      init: function() {
        this.appendDummyInput("INSTANCE").appendField(Blockly3.Translate("eventlist")).appendField(new Blockly3.FieldDropdown(instanceOptions()), "INSTANCE");
        this.appendValueInput("EVENT").appendField(Blockly3.Translate("eventlist_event"));
        for (const [name, word] of [
          ["VALUE", "eventlist_value"],
          ["ID", "eventlist_id"],
          ["ICON", "eventlist_icon"]
        ]) {
          this.appendValueInput(name).appendField(Blockly3.Translate(word));
          makeOptional(this, name);
        }
        this.appendDummyInput("LOG").appendField(Blockly3.Translate("eventlist_log")).appendField(new Blockly3.FieldDropdown(logLevelOptions()), "LOG");
        this.setInputsInline(false);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(Blockly3.Sendto.HUE);
        this.setTooltip(Blockly3.Translate("eventlist_tooltip"));
        this.setHelpUrl(Blockly3.Translate("eventlist_help"));
      }
    };
    registerGenerator("eventlist", (block) => {
      const instance = block.getFieldValue("INSTANCE");
      const logLevel = block.getFieldValue("LOG");
      const event = Blockly3.JavaScript.valueToCode(block, "EVENT", Blockly3.JavaScript.ORDER_ATOMIC);
      const value = Blockly3.JavaScript.valueToCode(block, "VALUE", Blockly3.JavaScript.ORDER_ATOMIC);
      const id = Blockly3.JavaScript.valueToCode(block, "ID", Blockly3.JavaScript.ORDER_ATOMIC);
      const icon = Blockly3.JavaScript.valueToCode(block, "ICON", Blockly3.JavaScript.ORDER_ATOMIC);
      const lines = [`sendTo('eventlist${instance}', 'insert', {
`];
      if (event) {
        lines.push(`  event: ${event},
`);
      }
      if (value) {
        lines.push(`  val: ${value},
`);
      }
      if (id) {
        lines.push(`  id: ${id},
`);
      }
      if (icon) {
        lines.push(`  icon: ${icon},
`);
      }
      lines.push(`});
${logLine(logLevel, "eventlist", event)}`);
      return lines.join("");
    });
  }

  // src-blockly/i18n/de.json
  var de_default = {
    eventlist: "Ereignis zur Ereignisliste hinzufügen",
    eventlist_delete: "Ereignisse aus der Ereignisliste löschen",
    eventlist_delete_all: "alle Ereignisse",
    eventlist_delete_filter: "Status-ID oder Zeit",
    eventlist_delete_tooltip: "Alle Ereignisse löschen, alle Ereignisse eines Status oder ein Ereignis anhand seiner Zeit",
    eventlist_delete_what: "Löschen",
    eventlist_event: "Ereignistext",
    eventlist_icon: "Symbol",
    eventlist_id: "Status-ID",
    eventlist_log: "Loglevel",
    eventlist_log_debug: "debug",
    eventlist_log_error: "error",
    eventlist_log_info: "info",
    eventlist_log_none: "keins",
    eventlist_log_warn: "warning",
    eventlist_tooltip: "Ein eigenes Ereignis zur Ereignisliste hinzufügen",
    eventlist_value: "Wert"
  };

  // src-blockly/i18n/en.json
  var en_default = {
    eventlist: "add event to event list",
    eventlist_delete: "delete events from event list",
    eventlist_delete_all: "all events",
    eventlist_delete_filter: "State ID or time",
    eventlist_delete_tooltip: "Delete all events, all events of one state or one event by its time",
    eventlist_delete_what: "Delete",
    eventlist_event: "Event text",
    eventlist_icon: "Icon",
    eventlist_id: "State ID",
    eventlist_log: "log level",
    eventlist_log_debug: "debug",
    eventlist_log_error: "error",
    eventlist_log_info: "info",
    eventlist_log_none: "none",
    eventlist_log_warn: "warning",
    eventlist_tooltip: "Add an own event to the event list",
    eventlist_value: "Value"
  };

  // src-blockly/i18n/es.json
  var es_default = {
    eventlist_delete_what: "Eliminar",
    eventlist_event: "Texto del evento",
    eventlist_icon: "Icono",
    eventlist_id: "ID del estado",
    eventlist_log: "nivel de registro",
    eventlist_log_debug: "depurar",
    eventlist_log_error: "error",
    eventlist_log_info: "información",
    eventlist_log_none: "ninguna",
    eventlist_log_warn: "advertencia",
    eventlist_value: "Valor"
  };

  // src-blockly/i18n/fr.json
  var fr_default = {
    eventlist_delete_what: "Supprimer",
    eventlist_event: "Texte de l'événement",
    eventlist_icon: "Icône",
    eventlist_id: "ID d'état",
    eventlist_log: "niveau de journalisation",
    eventlist_log_debug: "déboguer",
    eventlist_log_error: "Erreur",
    eventlist_log_info: "Info",
    eventlist_log_none: "aucun",
    eventlist_log_warn: "Attention",
    eventlist_value: "Valeur"
  };

  // src-blockly/i18n/it.json
  var it_default = {
    eventlist_delete_what: "Elimina",
    eventlist_event: "Testo dell'evento",
    eventlist_icon: "Icona",
    eventlist_id: "ID stato",
    eventlist_log: "livello log",
    eventlist_log_debug: "Debug",
    eventlist_log_error: "errore",
    eventlist_log_info: "Informazioni",
    eventlist_log_none: "nessuna",
    eventlist_log_warn: "avvertimento",
    eventlist_value: "Valore"
  };

  // src-blockly/i18n/nl.json
  var nl_default = {
    eventlist_delete_what: "Verwijderen",
    eventlist_event: "Gebeurtenistekst",
    eventlist_icon: "Icoon",
    eventlist_id: "Staat-ID",
    eventlist_log: "Log niveau",
    eventlist_log_debug: "Debug",
    eventlist_log_error: "fout",
    eventlist_log_info: "Info",
    eventlist_log_none: "geen",
    eventlist_log_warn: "waarschuwing",
    eventlist_value: "Waarde"
  };

  // src-blockly/i18n/pl.json
  var pl_default = {
    eventlist_delete_what: "Usunąć",
    eventlist_event: "Tekst wydarzenia",
    eventlist_icon: "Ikona",
    eventlist_id: "Identyfikator stanu",
    eventlist_log: "poziom dziennika",
    eventlist_log_debug: "odpluskwić",
    eventlist_log_error: "błąd",
    eventlist_log_info: "informacje",
    eventlist_log_none: "Żaden",
    eventlist_log_warn: "ostrzeżenie",
    eventlist_value: "Wartość"
  };

  // src-blockly/i18n/pt.json
  var pt_default = {
    eventlist_delete_what: "Excluir",
    eventlist_event: "Texto do evento",
    eventlist_icon: "Ícone",
    eventlist_id: "ID do estado",
    eventlist_log: "nível de log",
    eventlist_log_debug: "depurar",
    eventlist_log_error: "erro",
    eventlist_log_info: "info",
    eventlist_log_none: "Nenhum",
    eventlist_log_warn: "Atenção",
    eventlist_value: "Valor"
  };

  // src-blockly/i18n/ru.json
  var ru_default = {
    eventlist: "добавить событие в список событий",
    eventlist_delete: "удалить события из списка событий",
    eventlist_delete_all: "все события",
    eventlist_delete_filter: "ID состояния или время",
    eventlist_delete_tooltip: "Удалить все события, все события одного состояния или одно событие по его времени",
    eventlist_delete_what: "Удалить",
    eventlist_event: "Текст события",
    eventlist_icon: "Иконка",
    eventlist_id: "ID Состояния",
    eventlist_log: "Протокол",
    eventlist_log_debug: "debug",
    eventlist_log_error: "ошибка",
    eventlist_log_info: "инфо",
    eventlist_log_none: "нет",
    eventlist_log_warn: "warning",
    eventlist_tooltip: "Добавить собственное событие в список событий",
    eventlist_value: "Значение"
  };

  // src-blockly/i18n/uk.json
  var uk_default = {
    eventlist_delete_what: "Видалити",
    eventlist_event: "Текст події",
    eventlist_icon: "значок",
    eventlist_id: "Державний ідентифікатор",
    eventlist_value: "Значення"
  };

  // src-blockly/i18n/zh-cn.json
  var zh_cn_default = {
    eventlist_delete_what: "删除",
    eventlist_event: "活动文字",
    eventlist_icon: "图标",
    eventlist_id: "州ID",
    eventlist_value: "值"
  };

  // src-blockly/words.ts
  var Blockly4 = window.Blockly;
  var LANGUAGES = {
    de: de_default,
    en: en_default,
    es: es_default,
    fr: fr_default,
    it: it_default,
    nl: nl_default,
    pl: pl_default,
    pt: pt_default,
    ru: ru_default,
    uk: uk_default,
    "zh-cn": zh_cn_default
  };
  var README = "https://github.com/ioBroker/ioBroker.eventlist/blob/master/README.md";
  function installWords() {
    Blockly4.Translate || (Blockly4.Translate = function(word, lang) {
      lang || (lang = window.systemLang);
      const entry = Blockly4.Words?.[word];
      return entry ? entry[lang || "en"] || entry.en : word;
    });
    const words = {};
    for (const [lang, texts] of Object.entries(LANGUAGES)) {
      for (const [word, text] of Object.entries(texts)) {
        if (text) {
          (words[word] || (words[word] = {}))[lang] = text;
        }
      }
    }
    Object.assign(Blockly4.Words, words);
    Blockly4.Words.eventlist_help = { en: `${README}#message-box` };
  }

  // src-blockly/blockly.ts
  installWords();
  installInsert();
  installDelete();
})();
