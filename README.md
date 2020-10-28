# schmervice

A service layer for hapi

[![Build Status](https://travis-ci.org/hapipal/schmervice.svg?branch=master)](https://travis-ci.org/hapipal/schmervice) [![Coverage Status](https://coveralls.io/repos/hapipal/schmervice/badge.svg?branch=master&service=github)](https://coveralls.io/github/hapipal/schmervice?branch=master)

Lead Maintainer - [Devin Ivy](https://github.com/devinivy)

## Installation
```sh
npm install @hapipal/schmervice
```

## Usage
> See also the [API Reference](API.md)
>
> Schmervice is intended for use with hapi v19+ and nodejs v12+ (_see v1 for lower support_).

Services are a nice way to organize related business logic or transactions into classes.  Schmervice is a service layer designed to integrate nicely with hapi.  It consists of two parts that can be used together or separately:

  1. a base `Service` class that integrates your service with hapi by:
      - giving it access to the relevant `server` and plugin `options`.
      - allowing you to implement `async initialize()` and `async teardown()` methods that should run when the server initializes and stops.
      - allowing you to configure certain methods as being cacheable, with all the server method configuration that you're accustomed to.

  2. a hapi plugin that allows you to register services and access them where it is most convenient, such as in route handlers.  This registry respects plugin boundaries and is hierarchical, so unrelated plugins can safely register their own services without affecting each other.


```js
const Schmervice = require('@hapipal/schmervice');
const Hapi = require('@hapi/hapi');

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

### Functional style

Schmervice allows you to write services in a functional style in additional to the class-oriented approach shown above.  [`server.registerService()`](API.md#serverregisterserviceservicefactory) can be passed a plain object or a factory function.  Just make sure to name your service using the [`Schmervice.name`](API.md#schmervicename) symbol or a `name` property.  Here's a functional adaptation of the example above:

```js
const Schmervice = require('@hapipal/schmervice');
const Hapi = require('@hapi/hapi');

(async () => {

    const server = Hapi.server();

    await server.register(Schmervice);

    server.registerService(
        (srv) => ({
            [Schmervice.name]: 'mathService',
            add: (x, y) => {

                srv.log(['math-service'], 'Adding');

                return Number(x) + Number(y);
            },
            multiply: (x, y) => {

                srv.log(['math-service'], 'Multiplying');

                return Number(x) * Number(y);
            }
        })
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

### Using existing libraries as services

It's also possible to use existing libraries as services in your application.  Here's an example of how we might utilize [Nodemailer](https://nodemailer.com/) as a service for sending emails.  This example features [`Schmervice.withName()`](API.md#schmervicewithname), which is a convenient way to name your service using the [`Schmervice.name`](API.md#schmervicename) symbol, similarly to the example above:

```js
const Schmervice = require('@hapipal/schmervice');
const Nodemailer = require('nodemailer');
const Hapi = require('@hapi/hapi');

(async () => {

    const server = Hapi.server();

    await server.register(Schmervice);

    server.registerService(
        Schmervice.withName('emailService', () => {

            // Sendmail is a simple transport to configure for testing, but if you're
            // not seeing the sent emails then make sure to check your spam folder.

            return Nodemailer.createTransport({
                sendmail: true
            });
        })
    );

    server.route({
        method: 'get',
        path: '/email/{toAddress}/{message*}',
        handler: async (request) => {

            const { toAddress, message } = request.params;
            const { emailService } = request.services();

            await emailService.sendMail({
                from: 'no-reply@yoursite.com',
                to: toAddress,
                subject: 'A message for you',
                text: message
            });

            return { success: true };
        }
    });

    await server.start();

    console.log(`Start emailing at ${server.info.uri}`);
})();
```

## Extras
##### _What is a service layer?_
"Service layer" is a very imprecise term because it is utilized in all sorts of different ways by various developers and applications.  Our goal here is not to be prescriptive about how you use services.  But speaking generally, one might write code in a "service" as a way to group related business logic, data transactions (e.g. saving records to a database), or calls to external APIs.  Sometimes the service layer denotes a "headless" interface to all the actions you can take in an application, independent of any transport (such as HTTP), and hiding the app's data layer (or model) from its consumers.

In our case services make up a general-purpose "layer" or part of your codebase– concretely, they're just classes that are instanced once per server.  You can use them however you see fit!

hapi actually has a feature deeply related to this concept of services: [server methods](https://github.com/hapijs/hapi/blob/master/API.md#server.methods).  We love server methods, but also think they work better as a low-level API than being used directly in medium- and large-sized projects.  If you're already familiar with hapi server methods, you can think of schmervice as a tool to ergonomically create and use server methods (plus some other bells and whistles).
