// ==UserScript==
// @name         Wanikani: Back to back
// @namespace    http://tampermonkey.net/
// @version      1.2.4
// @description  Makes reading and meaning appear back to back in reviews and lessons
// @author       Kumirei
// @include      /^https://(www|preview).wanikani.com/(lesson|review|extra_study)/session/
// @license      MIT
// @grant        none
// ==/UserScript==

;(function (wkof, $) {
    // Page related info
    let currentItemKey, questionTypeKey, UIDPrefix, traceFunctionName
    let REVIEWS, LESSONS, EXTRA_STUDY
    if (/REVIEW/i.test(location.pathname)) {
        REVIEWS = true
        currentItemKey = 'currentItem'
        questionTypeKey = 'questionType'
        UIDPrefix = ''
        traceFunctionName = /randomQuestion/
    } else if (/LESSON/i.test(location.pathname)) {
        LESSONS = true
        currentItemKey = 'l/currentQuizItem'
        questionTypeKey = 'l/questionType'
        UIDPrefix = 'l/stats/'
        traceFunctionName = /selectItem/
    } else if (/EXTRA_STUDY/i.test(location.pathname)) {
        EXTRA_STUDY = true
        currentItemKey = 'currentItem'
        questionTypeKey = 'questionType'
        UIDPrefix = 'e/stats/'
        traceFunctionName = /selectQuestion/
    }

    // Script info
    const script_name = 'Back 2 Back'
    const script_id = 'back2back'

    // Make sure WKOF is installed
    confirm_wkof(script_name).then(start)

    // Startup
    function start() {
        wkof.include('Menu,Settings')
        wkof.ready('Menu,Settings').then(load_settings).then(install)
    }

    // Installs script functions on page
    function install() {
        install_menu()
        install_back2back()
        install_prioritization()
    }

    // Set up back to back meaning/reading reviews
    function install_back2back() {
        // Wrap jStorage.set(key, value) to ignore the value when the key is for the current item AND one item has
        // already been partially answered. If an item has been partially answered, then set the current item to
        // that item instead.
        const original_set = $.jStorage.set
        const new_set = function (key, value, options) {
            if (key === currentItemKey && wkof.settings[script_id].active) {
                const active_queue = $.jStorage.get(active_queue_key, [])
                for (const item of active_queue) {
                    const UID = (item.type == 'Kanji' ? 'k' : 'v') + item.id
                    const stats = $.jStorage.get(UIDPrefix + UID)
                    // Change the item if it has been answered in the session, regardless of whether the answer
                    // was correct.
                    if (stats) {
                        if (stats.mc) $.jStorage.set(questionTypeKey, 'reading')
                        if (stats.rc) $.jStorage.set(questionTypeKey, 'meaning')
                        return original_set.call(this, key, item, options)
                    }
                }
            }
            return original_set.call(this, key, value, options)
        }
        $.jStorage.set = new_set
    }

    // Set up prioritization of reading or meaning
    function install_prioritization() {
        // Run every time item changes
        $.jStorage.listenKeyChange(currentItemKey, prioritize)
        // Initialize session to prioritized question type
        prioritize()
    }

    // Prioritize reading or meaning
    function prioritize() {
        const prio = wkof.settings[script_id].prioritize
        const item = $.jStorage.get(currentItemKey)
        // Skip if item is a radical, it is already the right question, or no priority is selected
        if (item.type == 'Radical' || $.jStorage.get(questionTypeKey) == prio || 'none' == prio) return
        const UID = (item.type == 'Kanji' ? 'k' : 'v') + item.id
        const done = $.jStorage.get(UIDPrefix + UID)
        // Change the question if no question has been answered yet,
        // Or the priority question has not been answered correctly yet
        if (!done || !done[prio == 'reading' ? 'rc' : 'mc']) {
            $.jStorage.set(questionTypeKey, prio)
            $.jStorage.set(currentItemKey, item)
        }
    }

    /* ----------------------------------------------------------*/
    // WKOF setup
    /* ----------------------------------------------------------*/

    // Makes sure that WKOF is installed
    async function confirm_wkof() {
        if (!wkof) {
            let response = confirm(
                `${script_name} requires WaniKani Open Framework.\nClick "OK" to be forwarded to installation instructions.`,
            )
            if (response) {
                window.location.href =
                    'https://community.wanikani.com/t/instructions-installing-wanikani-open-framework/28549'
            }
            return
        }
    }

    // Load WKOF settings
    function load_settings() {
        const defaults = {
            prioritize: 'none',
            active: true,
        }
        return wkof.Settings.load(script_id, defaults)
    }

    // Installs the options button in the menu
    function install_menu() {
        const config = {
            name: script_id,
            submenu: 'Settings',
            title: script_name,
            on_click: open_settings,
        }
        wkof.Menu.insert_script_link(config)
    }

    // Opens settings dialogue when button is pressed
    function open_settings() {
        let config = {
            script_id: script_id,
            title: script_name,
            on_save: prioritize,
            content: {
                active: { type: 'checkbox', label: 'Active', default: true },
                prioritize: {
                    type: 'dropdown',
                    label: 'Prioritize',
                    default: 'reading',
                    content: { none: 'None', reading: 'Reading', meaning: 'Meaning' },
                },
            },
        }
        let dialog = new wkof.Settings(config)
        dialog.open()
    }
})(window.wkof, window.jQuery)
