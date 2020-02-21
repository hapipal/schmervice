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

exports.sandbox = Symbol('serviceSandbox');

exports.withName = (name, options, factory) => {

    if (typeof factory === 'undefined') {
        factory = options;
        options = {};
    }

    if (typeof factory === 'function' && !internals.isClass(factory)) {
        return (...args) => {

            const service = factory(...args);

            if (typeof service.then === 'function') {
                return service.then((x) => internals.withNameObject(name, options, x));
            }

            return internals.withNameObject(name, options, service);
        };
    }

    return internals.withNameObject(name, options, factory);
};

internals.withNameObject = (name, { sandbox }, obj) => {

    Hoek.assert(!obj[exports.name], 'Cannot apply a name to a service that already has one.');

    obj[exports.name] = name;

    if (typeof sandbox !== 'undefined') {
        Hoek.assert(typeof obj[exports.sandbox] === 'undefined', 'Cannot apply a sandbox setting to a service that already has one.');
        obj[exports.sandbox] = sandbox;
    }

    return obj;
};

internals.boundInstance = Symbol('boundInstance');

internals.services = (getRealm) => {

    return function (namespace) {

        const realm = getRealm(this);

        if (!namespace) {
            return internals.state(realm).services;
        }

        if (typeof namespace === 'string') {
            const namespaceSet = internals.rootState(realm).namespaces[namespace];
            Hoek.assert(namespaceSet, `The plugin namespace ${namespace} does not exist.`);
            Hoek.assert(namespaceSet.size === 1, `The plugin namespace ${namespace} is not unique: is that plugin registered multiple times?`);
            const [namespaceRealm] = [...namespaceSet.values()];
            return internals.state(namespaceRealm).services;
        }

        return internals.rootState(realm).services;
    };
};

internals.registerService = function (services) {

    services = [].concat(services);

    services.forEach((factory) => {

        const { name, instanceName, service, sandbox } = internals.serviceFactory(factory, this, this.realm.pluginOptions);
        const rootState = internals.rootState(this.realm);

        Hoek.assert(sandbox || !rootState.services[instanceName], `A service named ${name} has already been registered.`);

        rootState.namespaces[this.realm.plugin] = rootState.namespaces[this.realm.plugin] || new Set();
        rootState.namespaces[this.realm.plugin].add(this.realm);

        if (sandbox) {
            return internals.addServiceToRealm(this.realm, service, instanceName);
        }

        internals.forEachAncestorRealm(this.realm, (realm) => {

            internals.addServiceToRealm(realm, service, instanceName);
        });
    });
};

internals.addServiceToRealm = (realm, service, name) => {

    const state = internals.state(realm);
    Hoek.assert(!state.services[name], `A service named ${name} has already been registered in plugin namespace ${realm.plugin}.`);
    state.services[name] = service;
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

    const state = realm.plugins.schmervice = realm.plugins.schmervice || {
        services: {},
        namespaces: {}
    };

    return state;
};

internals.serviceFactory = (factory, server, options) => {

    Hoek.assert(factory && (typeof factory === 'object' || typeof factory === 'function'));

    if (typeof factory === 'function' && internals.isClass(factory)) {

        const name = factory[exports.name] || factory.name;
        Hoek.assert(name && typeof factory.name === 'string', 'The service class must have a name.');

        return {
            name,
            instanceName: factory[exports.name] ? name : internals.instanceName(name),
            sandbox: internals.sandbox(factory[exports.sandbox]),
            service: new factory(server, options)
        };
    }

    const service = (typeof factory === 'function') ? factory(server, options) : factory;
    Hoek.assert(service && typeof service === 'object');

    const name = service[exports.name] || service.name || Hoek.reach(service, ['realm', 'plugin']);
    Hoek.assert(name && typeof name === 'string', 'The service must have a name.');

    return {
        name,
        instanceName: service[exports.name] ? name : internals.instanceName(name),
        sandbox: internals.sandbox(service[exports.sandbox]),
        service
    };
};

internals.instanceName = (name) => {

    return name
        .replace(/[-_ ]+(.?)/g, (ignore, m) => m.toUpperCase())
        .replace(/^./, (m) => m.toLowerCase());
};

internals.sandbox = (value) => {

    if (value === 'plugin') {
        return true;
    }

    if (value === 'server') {
        return false;
    }

    return value;
};

internals.isClass = (func) => (/^\s*class\s/).test(func.toString());
