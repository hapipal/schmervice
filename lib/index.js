'use strict';

const Hoek = require('@hapi/hoek');
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

    bind() {

        if (!this[internals.boundInstance]) {

            const boundInstance = Object.create(this);

            let chain = boundInstance;

            while (chain !== Object.prototype) {

                for (const key of Reflect.ownKeys(chain)) {

                    if (key === 'constructor') {
                        continue;
                    }

                    const descriptor = Reflect.getOwnPropertyDescriptor(chain, key);

                    if (typeof descriptor.value === 'function') {
                        boundInstance[key] = boundInstance[key].bind(this);
                    }
                }

                chain = Reflect.getPrototypeOf(chain);
            }

            this[internals.boundInstance] = boundInstance;
        }

        return this[internals.boundInstance];
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

exports.name = Symbol('serviceName');

internals.boundInstance = Symbol('boundInstance');

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

    services.forEach((factory) => {

        const { name, instanceName, service } = internals.serviceFactory(factory, this, this.realm.pluginOptions);
        const rootState = internals.rootState(this.realm);

        Hoek.assert(!rootState[instanceName], `A service named ${name} has already been registered.`);

        internals.forEachAncestorRealm(this.realm, (realm) => {

            const state = internals.state(realm);
            state[instanceName] = service;
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

internals.serviceFactory = (factory, server, options) => {

    Hoek.assert(factory && (typeof factory === 'object' || typeof factory === 'function'));

    if (typeof factory === 'function' && internals.isClass(factory)) {

        const name = factory[exports.name] || factory.name;
        Hoek.assert(factory.name, 'The service class must have a name.');

        return {
            name,
            instanceName: factory[exports.name] ? name : internals.instanceName(name),
            service: new factory(server, options)
        };
    }

    const service = (typeof factory === 'function') ? factory(server, options) : factory;
    Hoek.assert(service && typeof service === 'object');

    const name = service[exports.name] || service.name || Hoek.reach(service, ['realm', 'plugin']);
    Hoek.assert(name, 'The service must have a name.');

    return {
        name,
        instanceName: factory[exports.name] ? name : internals.instanceName(name),
        service
    };
};

internals.instanceName = (name) => {

    return name
        .replace(/[-_]+(.)?/g, (ignore, m) => (m || '').toUpperCase())
        .replace(/^./, (m) => m.toLowerCase());
};

internals.isClass = (func) => (/^\s*class\s/).test(func.toString());
