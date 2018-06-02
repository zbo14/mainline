'use strict';

const Contact          = require('../lib/contact');
const { it }           = require('mocha');
const { createSocket } = require('dgram');

exports.fill = ( value, length ) => Array( length ).fill( value );

exports.parse = msg => JSON.parse( msg.toString() );

exports.replicate = ( f, length ) => Array.from({ length }, f );

exports.newServer = port => {
  const server = createSocket('udp4');
  server.contact = new Contact( `localhost:${port}` );
  server.id = server.contact.id;
  server.base64 = server.id.base64;
  server.bind( port );
  return server;
};

exports.wait = howLong => {
  it( 'waits for a bit', done => {
    setTimeout( done, howLong );
  }).timeout( howLong + 50 );
};
