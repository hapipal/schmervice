'use strict';

const Code = require('@hapi/code');
const Hapi = require('@hapi/hapi');
const Schmervice = require('..');
const Lab = require('@hapi/lab');

const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;

describe('Schmervice', () => {

    describe('Service class', () => {

        const sleep = (ms) => {

            return new Promise((resolve) => setTimeout(resolve, ms));
        };

        it('sets server and options on the instance.', () => {

            const service = new Schmervice.Service('server', 'options');

            expect(service.server).to.equal('server');
            expect(service.options).to.equal('options');
        });

        it('context getter returns server\'s context set with srv.bind().', () => {

            const server = Hapi.server();
            const service = new Schmervice.Service(server, {});

            expect(service.context).to.equal(null);

            const ctx = {};
            server.bind(ctx);

            expect(service.context).to.shallow.equal(ctx);
        });

        describe('bind() method', () => {

            it('binds functions', () => {

                const ServiceX = class ServiceX extends Schmervice.Service {
                    org() {

                        return this.context.org;
                    }
                };
                const server = Hapi.server();
                server.bind({ org: 'HapiPal' });
                const serviceX = new ServiceX(server, {});
                const { org } = serviceX.bind();

                expect(org()).to.equal('HapiPal');
            });

            it('returns a cached bound instance', () => {

                const ServiceX = class ServiceX extends Schmervice.Service {};
                const server = Hapi.server();
                const serviceX = new ServiceX(server, {});

                expect(serviceX.bind()).to.shallow.equal(serviceX.bind());
            });

            it('lazily creates a bound instance', () => {

                const ServiceX = class ServiceX extends Schmervice.Service {};
                const server = Hapi.server();
                const serviceX = new ServiceX(server, {});

                expect(serviceX._boundInstance).to.equal(undefined);

                serviceX.bind();

                expect(serviceX._boundInstance instanceof ServiceX).to.equal(true);
            });

            it('binds functions up the prototype chain (#Service.context)', () => {

                const ServiceX = class ServiceX extends Schmervice.Service {};
                const server = Hapi.server();
                server.bind({ org: 'HapiPal' });
                const serviceX = new ServiceX(server, {});
                const { context } = serviceX.bind();

                expect(context).to.equal({ org: 'HapiPal' });
            });

            it('bind functions up the prototype chain (#Service.caching)', async () => {

                const ServiceX = class ServiceX extends Schmervice.Service {

                    constructor(server, options) {

                        super(server, options);
                    }

                    add(a, b) {

                        this.called = (this.called || 0) + 1;

                        return a + b;
                    }
                };

                const server = Hapi.server();
                const serviceX = new ServiceX(server, {});
                const { caching } = serviceX.bind();

                caching({
                    add: {
                        expiresIn: 2000,
                        generateTimeout: false
                    }
                });

                // Replaced with server method
                expect(serviceX.add).to.not.shallow.equal(ServiceX.prototype.add);

                expect(await serviceX.add(1, 2)).to.equal(3);
                expect(serviceX.called).to.equal(1);

                expect(await serviceX.add(1, 2)).to.equal(3);
                expect(serviceX.called).to.equal(2);

                // Let the caching begin
                await server.initialize();

                expect(await serviceX.add(1, 2)).to.equal(3);
                expect(serviceX.called).to.equal(3);

                expect(await serviceX.add(1, 2)).to.equal(3);
                expect(serviceX.called).to.equal(3);

                expect(await serviceX.add(2, 3)).to.equal(5);
                expect(serviceX.called).to.equal(4);

                expect(await serviceX.add(2, 3)).to.equal(5);
                expect(serviceX.called).to.equal(4);
            });
        });

        it('runs initialize() onPreStart and teardown() onPostStop.', async () => {

            const ServiceX = class ServiceX extends Schmervice.Service {

                constructor(server, options) {

                    super(server, options);

                    this.initialized = false;
                    this.toredown = false;
                }

                async initialize() {

                    this.initialized = true;

                    await Promise.resolve();
                }

                async teardown() {

                    this.toredown = true;

                    await Promise.resolve();
                }
            };

            const server = Hapi.server();
            const serviceX = new ServiceX(server, {});

            expect(serviceX.initialized).to.equal(false);
            expect(serviceX.toredown).to.equal(false);

            await server.initialize();

            expect(serviceX.initialized).to.equal(true);
            expect(serviceX.toredown).to.equal(false);

            server.ext('onPreStop', () => {

                expect(serviceX.initialized).to.equal(true);
                expect(serviceX.toredown).to.equal(false);
            });

            await server.stop();

            expect(serviceX.initialized).to.equal(true);
            expect(serviceX.toredown).to.equal(true);
        });

        it('configures caching via static caching prop.', async () => {

            const ServiceX = class ServiceX extends Schmervice.Service {
                add(a, b) {

                    this.called = (this.called || 0) + 1;

                    return a + b;
                }
            };

            ServiceX.caching = {
                add: {
                    expiresIn: 2000,
                    generateTimeout: false
                }
            };

            const server = Hapi.server();
            const serviceX = new ServiceX(server, {});

            // Replaced with server method
            expect(serviceX.add).to.not.shallow.equal(ServiceX.prototype.add);

            expect(await serviceX.add(1, 2)).to.equal(3);
            expect(serviceX.called).to.equal(1);

            expect(await serviceX.add(1, 2)).to.equal(3);
            expect(serviceX.called).to.equal(2);

            // Let the caching begin
            await server.initialize();

            expect(await serviceX.add(1, 2)).to.equal(3);
            expect(serviceX.called).to.equal(3);

            expect(await serviceX.add(1, 2)).to.equal(3);
            expect(serviceX.called).to.equal(3);

            expect(await serviceX.add(2, 3)).to.equal(5);
            expect(serviceX.called).to.equal(4);

            expect(await serviceX.add(2, 3)).to.equal(5);
            expect(serviceX.called).to.equal(4);
        });

        it('configures caching via caching().', async () => {

            const ServiceX = class ServiceX extends Schmervice.Service {

                constructor(server, options) {

                    super(server, options);

                    this.caching({
                        add: {
                            expiresIn: 2000,
                            generateTimeout: false
                        }
                    });
                }

                add(a, b) {

                    this.called = (this.called || 0) + 1;

                    return a + b;
                }
            };

            const server = Hapi.server();
            const serviceX = new ServiceX(server, {});

            // Replaced with server method
            expect(serviceX.add).to.not.shallow.equal(ServiceX.prototype.add);

            expect(await serviceX.add(1, 2)).to.equal(3);
            expect(serviceX.called).to.equal(1);

            expect(await serviceX.add(1, 2)).to.equal(3);
            expect(serviceX.called).to.equal(2);

            // Let the caching begin
            await server.initialize();

            expect(await serviceX.add(1, 2)).to.equal(3);
            expect(serviceX.called).to.equal(3);

            expect(await serviceX.add(1, 2)).to.equal(3);
            expect(serviceX.called).to.equal(3);

            expect(await serviceX.add(2, 3)).to.equal(5);
            expect(serviceX.called).to.equal(4);

            expect(await serviceX.add(2, 3)).to.equal(5);
            expect(serviceX.called).to.equal(4);
        });

        it('only allows caching to be configured once.', () => {

            const ServiceX = class ServiceX extends Schmervice.Service {

                constructor(server, options) {

                    super(server, options);

                    this.caching({
                        add: {
                            expiresIn: 2000,
                            generateTimeout: false
                        }
                    });
                }

                add(a, b) {

                    this.called = (this.called || 0) + 1;

                    return a + b;
                }
            };

            ServiceX.caching = {
                add: {
                    expiresIn: 2000,
                    generateTimeout: false
                }
            };

            const server = Hapi.server();

            expect(() => new ServiceX(server, {})).to.throw('Caching config can only be specified once.');
        });

        it('accepts caching config in form { cache, generateKey }.', async () => {

            const ServiceX = class ServiceX extends Schmervice.Service {

                async add(a, b, fail) {

                    this.called = (this.called || 0) + 1;

                    if (fail) {
                        await sleep(3); // Longer than generateTimeout
                    }

                    return a + b;
                }
            };

            ServiceX.caching = {
                add: {
                    cache: {
                        expiresIn: 100,
                        generateTimeout: 2
                    },
                    generateKey: (a, b) => {

                        // Addition is commutative
                        return (a < b) ? `${a}:${b}` : `${b}:${a}`;
                    }
                }
            };

            const server = Hapi.server();
            const serviceX = new ServiceX(server, {});

            await server.initialize();

            expect(serviceX.called).to.not.exist();

            // Check { generateKey }
            await serviceX.add(1, 2, false);
            expect(serviceX.called).to.equal(1);

            await serviceX.add(2, 1, false);
            expect(serviceX.called).to.equal(1);

            await serviceX.add(1, 3, false);
            expect(serviceX.called).to.equal(2);

            // Check { cache }
            await expect(serviceX.add(1, 4, true)).to.reject('Service Unavailable');
        });

        it('accepts caching config in form { ...cache }.', async () => {

            const ServiceX = class ServiceX extends Schmervice.Service {

                async add(a, b) {

                    await sleep(3); // Longer than generateTimeout

                    return a + b;
                }
            };

            ServiceX.caching = {
                add: {
                    generateTimeout: 2
                }
            };

            const server = Hapi.server();
            const serviceX = new ServiceX(server, {});

            await server.initialize();

            await expect(serviceX.add(1, 2)).to.reject('Service Unavailable');
        });
    });

    describe('plugin', () => {

        it('can be registered multiple times.', async () => {

            const server = Hapi.server();

            expect(server.services).to.not.be.a.function();
            expect(server.registerService).to.not.be.a.function();

            await server.register(Schmervice);
            expect(server.services).to.be.a.function();
            expect(server.registerService).to.be.a.function();

            await server.register(Schmervice);
            expect(server.services).to.be.a.function();
            expect(server.registerService).to.be.a.function();
        });

        describe('server.registerService() decoration', () => {

            it('registers a single service, passing server and options.', async () => {

                const server = Hapi.server();
                await server.register(Schmervice);

                const ServiceX = class ServiceX {
                    constructor(...args) {

                        this.args = args;
                    }
                };

                server.registerService(ServiceX);

                expect(server.services()).to.only.contain(['serviceX']);

                const { serviceX } = server.services();

                expect(serviceX).to.be.an.instanceof(ServiceX);
                expect(serviceX.args).to.have.length(2);
                expect(serviceX.args[0]).to.shallow.equal(server);
                expect(serviceX.args[1]).to.shallow.equal(server.realm.pluginOptions);
                expect(serviceX.args[1]).to.equal({});
            });

            it('registers an array of services, passing server and options.', async () => {

                const server = Hapi.server();
                await server.register(Schmervice);

                const ServiceX = class ServiceX {
                    constructor(...args) {

                        this.args = args;
                    }
                };

                const ServiceY = class ServiceY {
                    constructor(...args) {

                        this.args = args;
                    }
                };

                server.registerService([ServiceX, ServiceY]);

                expect(server.services()).to.only.contain(['serviceX', 'serviceY']);

                const { serviceX, serviceY } = server.services();

                expect(serviceX).to.be.an.instanceof(ServiceX);
                expect(serviceX.args).to.have.length(2);
                expect(serviceX.args[0]).to.shallow.equal(server);
                expect(serviceX.args[1]).to.shallow.equal(server.realm.pluginOptions);
                expect(serviceX.args[1]).to.equal({});

                expect(serviceY).to.be.an.instanceof(ServiceY);
                expect(serviceY.args).to.have.length(2);
                expect(serviceY.args[0]).to.shallow.equal(server);
                expect(serviceY.args[1]).to.shallow.equal(server.realm.pluginOptions);
                expect(serviceY.args[1]).to.equal({});
            });

            it('throws when a service has no name.', async () => {

                const server = Hapi.server();
                await server.register(Schmervice);

                expect(() => server.registerService(class {})).to.throw('The service class must have a name.');
            });

            it('throws when two services with the same name are registered.', async () => {

                const server = Hapi.server();
                await server.register(Schmervice);

                server.registerService(class ServiceX {});
                expect(() => server.registerService(class ServiceX {})).to.throw('A service named ServiceX has already been registered.');
            });
        });

        describe('request.services() decoration', () => {

            it('returns service instances associated with the relevant route\'s realm.', async () => {

                const server = Hapi.server();
                await server.register(Schmervice);

                const ServiceX = class ServiceX {};
                server.registerService(class ServiceY {});

                let handlerServices;
                let extServices;

                const plugin = {
                    name: 'plugin',
                    register(srv, options) {

                        srv.registerService(ServiceX);

                        srv.route({
                            method: 'get',
                            path: '/',
                            handler(request) {

                                handlerServices = request.services();

                                return { ok: true };
                            }
                        });

                        srv.ext('onPreAuth', (request, h) => {

                            extServices = request.services();

                            return h.continue;
                        });
                    }
                };

                await server.register(plugin);

                await server.inject('/');

                expect(handlerServices).to.shallow.equal(extServices);
                expect(handlerServices).to.only.contain(['serviceX']);
                const { serviceX } = handlerServices;
                expect(serviceX).to.be.an.instanceof(ServiceX);
            });

            it('returns empty object if there are no services associated with relevant route\'s realm.', async () => {

                const server = Hapi.server();
                await server.register(Schmervice);

                server.registerService(class ServiceX {});

                let handlerServices;
                let extServices;

                const plugin = {
                    name: 'plugin',
                    register(srv, options) {

                        srv.route({
                            method: 'get',
                            path: '/',
                            handler(request) {

                                handlerServices = request.services();

                                return { ok: true };
                            }
                        });

                        srv.ext('onPreAuth', (request, h) => {

                            extServices = request.services();

                            return h.continue;
                        });
                    }
                };

                await server.register(plugin);

                await server.inject('/');

                expect(handlerServices).to.equal({});
                expect(extServices).to.equal({});
                expect(handlerServices).to.shallow.equal(extServices);
            });

            it('returns service instances associated with the root realm when passed true.', async () => {

                const server = Hapi.server();
                await server.register(Schmervice);

                const ServiceX = class ServiceX {};
                const ServiceY = class ServiceY {};
                server.registerService(ServiceY);

                let handlerServices;
                let extServices;

                const plugin = {
                    name: 'plugin',
                    register(srv, options) {

                        srv.registerService(ServiceX);

                        srv.route({
                            method: 'get',
                            path: '/',
                            handler(request) {

                                handlerServices = request.services(true);

                                return { ok: true };
                            }
                        });

                        srv.ext('onPreAuth', (request, h) => {

                            extServices = request.services(true);

                            return h.continue;
                        });
                    }
                };

                await server.register(plugin);

                await server.inject('/');

                expect(handlerServices).to.shallow.equal(extServices);
                expect(handlerServices).to.only.contain(['serviceX', 'serviceY']);
                const { serviceX, serviceY } = handlerServices;
                expect(serviceX).to.be.an.instanceof(ServiceX);
                expect(serviceY).to.be.an.instanceof(ServiceY);
            });
        });

        describe('h.services() decoration', () => {

            it('returns service instances associated with toolkit\'s realm.', async () => {

                const server = Hapi.server();
                await server.register(Schmervice);

                const ServiceX = class ServiceX {};
                server.registerService(class ServiceY {});

                let handlerServices;
                let extServices;

                const plugin = {
                    name: 'plugin',
                    register(srv, options) {

                        srv.registerService(ServiceX);

                        srv.route({
                            method: 'get',
                            path: '/',
                            handler(request, h) {

                                handlerServices = h.services();

                                return { ok: true };
                            }
                        });

                        srv.ext('onRequest', (request, h) => {

                            extServices = h.services();

                            return h.continue;
                        });
                    }
                };

                await server.register(plugin);

                await server.inject('/');

                expect(handlerServices).to.shallow.equal(extServices);
                expect(handlerServices).to.only.contain(['serviceX']);
                const { serviceX } = handlerServices;
                expect(serviceX).to.be.an.instanceof(ServiceX);
            });

            it('returns empty object if there are no services associated with toolkit\'s realm.', async () => {

                const server = Hapi.server();
                await server.register(Schmervice);

                server.registerService(class ServiceX {});

                let handlerServices;
                let extServices;

                const plugin = {
                    name: 'plugin',
                    register(srv, options) {

                        srv.route({
                            method: 'get',
                            path: '/',
                            handler(request, h) {

                                handlerServices = h.services();

                                return { ok: true };
                            }
                        });

                        srv.ext('onRequest', (request, h) => {

                            extServices = h.services();

                            return h.continue;
                        });
                    }
                };

                await server.register(plugin);

                await server.inject('/');

                expect(handlerServices).to.equal({});
                expect(extServices).to.equal({});
                expect(handlerServices).to.shallow.equal(extServices);
            });

            it('returns service instances associated with the root realm when passed true.', async () => {

                const server = Hapi.server();
                await server.register(Schmervice);

                const ServiceX = class ServiceX {};
                const ServiceY = class ServiceY {};
                server.registerService(ServiceY);

                let handlerServices;
                let extServices;

                const plugin = {
                    name: 'plugin',
                    register(srv, options) {

                        srv.registerService(ServiceX);

                        srv.route({
                            method: 'get',
                            path: '/',
                            handler(request, h) {

                                handlerServices = h.services(true);

                                return { ok: true };
                            }
                        });

                        srv.ext('onRequest', (request, h) => {

                            extServices = h.services(true);

                            return h.continue;
                        });
                    }
                };

                await server.register(plugin);

                await server.inject('/');

                expect(handlerServices).to.shallow.equal(extServices);
                expect(handlerServices).to.only.contain(['serviceX', 'serviceY']);
                const { serviceX, serviceY } = handlerServices;
                expect(serviceX).to.be.an.instanceof(ServiceX);
                expect(serviceY).to.be.an.instanceof(ServiceY);
            });
        });

        describe('server.services() decoration', () => {

            it('returns service instances associated with server\'s realm.', async () => {

                const server = Hapi.server();
                await server.register(Schmervice);

                const ServiceX = class ServiceX {};
                server.registerService(class ServiceY {});

                let srvServices;

                const plugin = {
                    name: 'plugin',
                    register(srv, options) {

                        srv.registerService(ServiceX);

                        srvServices = srv.services();
                    }
                };

                await server.register(plugin);

                expect(srvServices).to.only.contain(['serviceX']);
                const { serviceX } = srvServices;
                expect(serviceX).to.be.an.instanceof(ServiceX);
            });

            it('returns empty object if there are no services associated with toolkit\'s realm.', async () => {

                const server = Hapi.server();
                await server.register(Schmervice);

                server.registerService(class ServiceX {});

                let srvServices;

                const plugin = {
                    name: 'plugin',
                    register(srv, options) {

                        srvServices = srv.services();
                    }
                };

                await server.register(plugin);

                expect(srvServices).to.equal({});
            });

            it('returns service instances associated with the root realm when passed true.', async () => {

                const server = Hapi.server();
                await server.register(Schmervice);

                const ServiceX = class ServiceX {};
                const ServiceY = class ServiceY {};
                server.registerService(ServiceY);

                let srvServices;

                const plugin = {
                    name: 'plugin',
                    register(srv, options) {

                        srv.registerService(ServiceX);

                        srvServices = srv.services(true);
                    }
                };

                await server.register(plugin);

                expect(srvServices).to.only.contain(['serviceX', 'serviceY']);
                const { serviceX, serviceY } = srvServices;
                expect(serviceX).to.be.an.instanceof(ServiceX);
                expect(serviceY).to.be.an.instanceof(ServiceY);
            });
        });

        describe('service ownership', () => {

            it('applies to server\'s realm and its ancestors.', async () => {

                const makePlugin = (name, services, plugins) => ({
                    name,
                    async register(srv, options) {

                        await srv.register(plugins);
                        srv.registerService(services);
                        srv.expose('services', () => srv.services());
                    }
                });

                const ServiceO = class ServiceO {};
                const ServiceA1 = class ServiceA1 {};
                const ServiceA1a = class ServiceA1a {};
                const ServiceA1b = class ServiceA1b {};
                const ServiceA2 = class ServiceA2 {};
                const ServiceX1a = class ServiceX1a {};

                const server = Hapi.server();
                await server.register(Schmervice);

                const pluginX1a = makePlugin('pluginX1a', [], []);
                const pluginX1 = makePlugin('pluginX1', [ServiceX1a], [pluginX1a]);
                const pluginX = makePlugin('pluginX', [], [pluginX1]);
                const pluginA1 = makePlugin('pluginA1', [ServiceA1a, ServiceA1b], []);
                const pluginA = makePlugin('pluginA', [ServiceA1, ServiceA2], [pluginA1, pluginX]);

                server.registerService(ServiceO);

                await server.register(pluginA);

                const {
                    pluginX1a: X1a,
                    pluginX1: X1,
                    pluginX: X,
                    pluginA1: A1,
                    pluginA: A
                } = server.plugins;

                expect(X1a.services()).to.equal({});
                expect(X1.services()).to.only.contain([
                    'serviceX1a'
                ]);
                expect(X.services()).to.only.contain([
                    'serviceX1a'
                ]);
                expect(A1.services()).to.only.contain([
                    'serviceA1a',
                    'serviceA1b'
                ]);
                expect(A.services()).to.only.contain([
                    'serviceA1',
                    'serviceA1a',
                    'serviceA1b',
                    'serviceA2',
                    'serviceX1a'
                ]);
                expect(server.services()).to.only.contain([
                    'serviceO',
                    'serviceA1',
                    'serviceA1a',
                    'serviceA1b',
                    'serviceA2',
                    'serviceX1a'
                ]);
            });
        });
    });
});
