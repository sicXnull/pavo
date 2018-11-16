/**
 * @file
 * @version 0.1
 * @copyright 2018 CN-Consult GmbH
 * @author Yannick Lapp <yannick.lapp@cn-consult.eu>
 */

const ReloadBrowserWindowManager = require(__dirname + "/BrowserWindowManager/ReloadBrowserWindowManager");
const StaticBrowserWindowManager = require(__dirname + "/BrowserWindowManager/StaticBrowserWindowManager");
const TabReloadLoop = require(__dirname + "/TabReloadLoop");
const tabDisplayerLogger = require("log4js").getLogger("tabDisplayer");

/**
 * Manages showing and hiding of tabs for a window.
 * This class can only show tabs from the tab list that it was initialized with.
 */
class TabDisplayer
{
    /**
     * TabDisplayer constructor.
     */
    constructor()
    {
        this.currentTabType = "";
        this.currentTab = null;
    }


    // Getters and Setters

    /**
     * Returns the currently displayed tab.
     *
     * @returns {Tab} The currently displayed tab
     */
    getCurrentTab()
    {
        return this.currentTab;
    }

    /**
     * Returns the tab list.
     *
     * @returns {TabList} The tab list
     */
    getTabList()
    {
        return this.tabList;
    }


    // Public Methods

    /**
     * Initializes the TabDisplayer.
     *
     * @param {Object} _browserWindowConfiguration The browser window configuration
     * @param {TabList} _tabList The tab list
     *
     * @return {Promise} The promise that initializes the TabDisplayer
     */
    initialize(_browserWindowConfiguration, _tabList)
    {
        this.tabList = _tabList;

        // Initialize the browser window managers (if needed)
        let self = this;
        return new Promise(function(_resolve){
            self.initializeReloadBrowserWindowManager(_browserWindowConfiguration, _tabList);
            self.initializeStaticBrowserWindowManager(_browserWindowConfiguration, _tabList).then(function(){
                _resolve("TabSwitcher initialized");
            });
        });
    }

    /**
     * Moves a specific tab to the top of the stack of browser windows.
     *
     * @param {Tab} _tab The tab
     *
     * @returns {Promise} The promise that moves the tab to the top of the stack of browser windows
     */
    showTab(_tab)
    {
        tabDisplayerLogger.debug("Showing tab #" + _tab.getDisplayId());

        let self = this;
        return new Promise(function(_resolve, _reject){

            if (_tab)
            {
                if (_tab !== self.currentTab)
                {
                    if (_tab.getReloadTime() === 0)
                    {
                        self.staticBrowserWindowManager.showTab(_tab).then(function(){
                            self.hideCurrentTab("static").then(function(){
                                self.currentTabType = "static";
                                self.currentTab = _tab;
                                _resolve("Switched to static tab");
                            });
                        });
                    }
                    else
                    {
                        tabDisplayerLogger.debug("Starting reload loop of #" + _tab.getDisplayId());
                        self.tabReloadLoop.start(_tab).then(function(){
                            self.hideCurrentTab("reload").then(function(){
                                self.currentTabType = "reload";
                                self.currentTab = _tab;
                                _resolve("Switched to reload tab");
                            });
                        });
                    }
                }
                else _resolve("No tab switching necessary: Tab is already being displayed");
            }
            else _reject("Cannot switch to tab: Tab is not set");
        });
    }

    /**
     * Reloads a tab if it is a static tab.
     *
     * @param {Tab} _tab The tab
     *
     * @returns {Promise} The promise that reloads the tab if its static
     */
    reloadStaticTab(_tab)
    {
        let self  =this;
        return new Promise(function(_resolve){
            if (_tab.getReloadTime() === 0)
            {
                tabDisplayerLogger.debug("Reloading tab #" + _tab.getDisplayId());

                self.staticBrowserWindowManager.reloadTabBrowserWindow(_tab).then(function() {
                    _resolve("Tab reloaded.");
                });
            }
            else _resolve("No tab reload necessary.");
        });
    }


    // Private Methods

    /**
     * Initializes the reload browser window manager if necessary.
     *
     * @param {Object} _browserWindowConfiguration The browser window configuration
     * @param {TabList} _tabList The tab list
     */
    initializeReloadBrowserWindowManager(_browserWindowConfiguration, _tabList)
    {
        if (_tabList.containsReloadTabs())
        {
            this.reloadBrowserWindowManager = new ReloadBrowserWindowManager(_browserWindowConfiguration);
            this.tabReloadLoop = new TabReloadLoop(this.reloadBrowserWindowManager);
        }
    }

    /**
     * Initializes the static browser window manager if necessary.
     *
     * @param {Object} _browserWindowConfiguration The browser window configuration
     * @param {TabList} _tabList The tab list
     *
     * @return {Promise} The promise that initializes the static browser window manager if necessary
     */
    initializeStaticBrowserWindowManager(_browserWindowConfiguration, _tabList)
    {
        if (_tabList.containsStaticTabs())
        {
            this.staticBrowserWindowManager = new StaticBrowserWindowManager(_browserWindowConfiguration);

            // Add all static tabs to the static browser window manager
            let staticTabs = _tabList.getStaticTabs();
            let numberOfStaticTabs = staticTabs.length;

            let self = this;
            return new Promise(function(_resolve){
                staticTabs.forEach(function(_tab){
                    // TODO: Initialize tabs one by one instead of asynchronous (too lower CPU stress)
                    self.staticBrowserWindowManager.addTab(_tab).then(function(_numberOfTabBrowserWindows){
                        if (_numberOfTabBrowserWindows === numberOfStaticTabs)
                        {
                            _resolve("All static tabs initialized.");
                        }
                    });
                });
            });
        }
        else return new Promise(function(_resolve){
            _resolve("No static tab initialization necessary.");
        });
    }

    /**
     * Hides the currently displayed tab.
     *
     * @return {Promise} The promise that hides the currently displayed tab
     */
    hideCurrentTab(_newTabType)
    {
        if (this.currentTabType !== _newTabType)
        {
            if (this.currentTabType === "" || this.currentTab === null)
            {
                return new Promise(function(_resolve){
                    _resolve("No tab hiding necessary (initial cycle).");
                });
            }
            else
            {
                tabDisplayerLogger.debug("Hiding tab #" + this.currentTab.getDisplayId());

                if (this.currentTabType === "static")
                {
                    return this.staticBrowserWindowManager.hideCurrentBrowserWindow();
                }
                else if (this.currentTabType === "reload")
                {
                    let self = this;
                    let stopTabReloadLoop = new Promise(function(_resolve){
                        if (self.tabReloadLoop.getIsActive())
                        {
                            tabDisplayerLogger.debug("Stopping reload loop of #" + self.tabReloadLoop.getReloadTab().getDisplayId());
                            self.tabReloadLoop.stop().then(function(){
                                _resolve("Tab reload loop stopped");
                            })
                        }
                        else _resolve("Tab reload loop already stopped");
                    });

                    return new Promise(function(_resolve){
                        stopTabReloadLoop.then(function(){
                            self.reloadBrowserWindowManager.hideCurrentBrowserWindow().then(function(){
                                _resolve("Reload tab hidden");
                            });
                        });
                    });
                }
                else
                {
                    let currentTabType = this.currentTabType;
                    return new Promise(function(_resolve, _reject){
                        _reject("Invalid tab type '" + currentTabType + "'");
                    })
                }
            }
        }
        else return new Promise(function(_resolve){
            _resolve("No tab hiding necessary (same browser window manager).");
        });
    }
}


/**
 * The tab type of the currently displayed tab ("static" or "reload").
 * This is used to determine the browser window manager that has to hide its currently displayed browser window.
 *
 * @type {string} currentTabType
 */
TabDisplayer.currentTabType = "";

/**
 * The tab that is currently displayed
 *
 * @type {Tab} currentTab
 */
TabDisplayer.currentTab = null;

/**
 * The tab list
 *
 * @type {TabList} tabList
 */
TabDisplayer.tabList = null;

/**
 * The tab reload loop which is used to display reload tabs
 *
 * @type {TabReloadLoop} tabReloadLoop
 */
TabDisplayer.tabReloadLoop = null;

/**
 * The browser window manager for reloads
 *
 * @type {ReloadBrowserWindowManager} reloadBrowserWindowManager
 */
TabDisplayer.reloadBrowserWindowManager = null;

/**
 * The static browser window manager which is used to display static tabs
 *
 * @type {StaticBrowserWindowManager} staticBrowserWindowManager
 */
TabDisplayer.staticBrowserWindowManager = null;


module.exports = TabDisplayer;