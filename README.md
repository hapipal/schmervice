# schmervice

a service layer for hapi

[![Build Status](https://travis-ci.org/devinivy/schmervice.svg?branch=master)](https://travis-ci.org/devinivy/schmervice) [![Coverage Status](https://coveralls.io/repos/devinivy/schmervice/badge.svg?branch=master&service=github)](https://coveralls.io/github/devinivy/schmervice?branch=master)

## Usage
> See also the [API Reference](API.md)

Services are a nice way to organize related business logic or transactions into classes.  Schmervice is a service layer designed to integrate nicely with hapi.  It consists of two parts that can be used together or separately,

  1. a base `Service` class that integrates your service with hapi by,
    - giving it access to the relevant `server` and plugin `options`.
    - allowing you to implement `async initialize()` and `async teardown()` methods that should run when the server initializes and stops.
    - allowing you to configure certain methods as being cacheable, with all the server method configuration that you're accustomed to.

  2. A hapi plugin that allows you to register services and access them where it is most convenient, such as in route handlers.  This registry respects plugin boundaries and is hierarchical, so unrelated plugins can safely register their own services without affecting each other.


```js
const Schmervice = require('schmervice');
const Hapi = require('hapi');

(async () => {

    const server = Hapi.server();

    await server.register(Schmervice);

    server.registerService(
        class MathService extends Schmervice.Service {

            add(x, y) {

                this.server.log(['math-service'], 'Adding');

                return Number(x) + Number(y);
            }

            multiply(x, y) {

                this.server.log(['math-service'], 'Multiplying');

                return Number(x) * Number(y);
            }
        }
    );

    server.route({
        method: 'get',
        path: '/add/{a}/{b}',
        handler: (request) => {

            const { a, b } = request.params;
            const { mathService } = request.services();

            return mathService.add(a, b);
        }
    });

    await server.start();

    console.log(`Start adding at ${server.info.uri}`);
})();
```

## Extras
##### _What is a service layer?_
"Service layer" is a very imprecise term because it is utilized in all sorts of different ways by various developers and applications.  Our goal here is not to be prescriptive about how you use services.  But speaking generally, one might write code in a "service" as a way to group related business logic, data transactions (e.g. saving records to a database), or calls to external APIs.  Sometimes the service layer denotes a "headless" interface to all the actions you can take in an application, independent of any transport (such as HTTP), and hiding the app's data layer (or model) from its consumers.

In our case services make up a general-purpose "layer" or part of your codebase– concretely, they're just classes that are instanced once per server.  You can use them however you see fit!

hapi actually has a feature deeply related to this concept of services: [server methods](https://github.com/hapijs/hapi/blob/master/API.md#server.methods).  We love server methods, but also think they work better as a low-level API than being used directly in medium- and large-sized projects.  If you're already familiar with hapi server methods, you can think of schmervice as a tool to ergonomically create and use server methods (plus some other bells and whistles).
