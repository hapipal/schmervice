'use strict';

const Hoek = require('hoek');
const Package = require('../package.json');

const internals = {};

exports.Service = class Service {

    constructor(server, options) {

        this.server = server;
        this.options = options;

        if (typeof this.initialize === 'function') {
            this.server.ext('onPreStart', this.initialize, { bind: this });
        }

        if (typeof this.teardown === 'function') {
            this.server.ext('onPostStop', this.teardown, { bind: this });
        }

        if (this.constructor.caching) {
            this.caching(this.constructor.caching);
        }
    }

    get context() {

        return this.server.realm.settings.bind || null;
    }

    caching(options) {

        Hoek.assert(this.constructor.name, 'The service class must have a name in order to configure caching.');
        Hoek.assert(!this.__caching, 'Caching config can only be specified once.');
        this.__caching = true;

        const instanceName = internals.instanceName(this.constructor.name);

        Object.keys(options).forEach((methodName) => {

            const generateKey = options[methodName].generateKey;

            const cache = options[methodName].cache ?
                { ...options[methodName].cache } :
                { ...options[methodName] };

            delete cache.generateKey;

            this.server.method({
                name: `schmervice.${instanceName}.${methodName}`,
                method: this[methodName],
                options: {
                    bind: this,
                    generateKey,
                    cache
                }
            });

            this[methodName] = this.server.methods.schmervice[instanceName][methodName];
        });
    }
};

exports.plugin = {
    pkg: Package,
    once: true,
    register(server) {

        server.decorate('server', 'registerService', internals.registerService);
        server.decorate('server', 'services', internals.services((srv) => srv.realm));
        server.decorate('request', 'services', internals.services((request) => request.route.realm));
        server.decorate('toolkit', 'services', internals.services((h) => h.realm));
    }
};

internals.services = (getRealm) => {

    return function (all) {

        const realm = getRealm(this);

        return all ?
            internals.rootState(realm) :
            internals.state(realm);
    };
};

internals.registerService = function (services) {

    services = [].concat(services);

    services.forEach((Service) => {

        Hoek.assert(Service.name, 'The service class must have a name.');

        const rootState = internals.rootState(this.realm);
        const instanceName = internals.instanceName(Service.name);

        Hoek.assert(!rootState[instanceName], `A service named ${Service.name} has already been registered.`);

        const serviceInstance = new Service(this, this.realm.pluginOptions);

        internals.forEachAncestorRealm(this.realm, (realm) => {

            const state = internals.state(realm);
            state[instanceName] = serviceInstance;
        });
    });
};

internals.forEachAncestorRealm = (realm, fn) => {

    do {
        fn(realm);
        realm = realm.parent;
    }
    while (realm);
};

internals.rootState = (realm) => {

    while (realm.parent) {
        realm = realm.parent;
    }

    return internals.state(realm);
};

internals.state = (realm) => {

    const state = realm.plugins.schmervice = realm.plugins.schmervice || {};
    return state;
};

internals.instanceName = (className) => {

    return className[0].toLowerCase() + className.slice(1);
};
