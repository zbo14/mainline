'use strict';

const { createSocket } = require('dgram');
const Contact          = require('./contact');
const Id               = require('./id');
const RoutingTable     = require('./routingtable');

class Server {
  /**
   * constructor
   * @param {(Object|string)} info
   */
  constructor( info ) {
    this.contact = new Contact( info );
    this.routingTable = new RoutingTable();
    this.socket = createSocket('udp4');
    this.on( 'message', ( msg, rinfo ) => {
      msg = JSON.parse( msg.toString() );
      const contact = new Contact({
        host: rinfo.address,
        port: rinfo.port
      });
      this.handleMessage( contact, msg );
    });
    this.socket.bind( this.contact.port );
  }

  emit( evt, ...params ) {
    this.socket.emit( evt, ...params );
  }

  on( evt, cb ) {
    this.socket.on( evt, ( ...params ) => setImmediate( cb, ...params ) );
  }

  once( evt, cb ) {
    this.socket.once( evt, ( ...params ) => setImmediate( cb, ...params ) );
  }

  /**
   * @member {string}
   */
  get base64() {
    return this.id.base64;
  }

  /**
   * @member {Id}
   */
  get id() {
    return this.contact.id;
  }

  /**
   * @param  {Id}     id
   * @return {boolean}
   */
  hasContact( id ) {
    return this.routingTable.hasContact( id );
  }

  handleMessage( contact, msg ) {
    switch ( msg.cmd ) {
      case 'ping':
        return this.handlePing( contact, msg );
      case 'pong':
        return this.handlePong( contact, msg );
      case 'find':
        return this.handleFind( contact, msg );
      case 'found':
        return this.handleFound( contact, msg );
      default:
    }
  }

  handlePing( contact, msg ) {
    contact.pong( this, msg.tx );
  }

  handlePong( contact, msg ) {
    this.emit( `${contact.base64}:${msg.tx}` );
  }

  handleFind( contact, msg ) {
    const target = new Id( Buffer.from( msg.data, 'base64' ) );
    const result = this.routingTable.find( target );
    if ( result instanceof Array ) {
      return contact.foundClosest( this, result, msg.tx );
    }
    contact.foundContact( this, result, msg.tx );
  }

  handleFound( contact, msg ) {
    let result;
    if ( msg.data instanceof Array ) {
      result = msg.data.map( info => new Contact( info ) );
    } else {
      result = new Contact( msg.data );
    }
    this.emit( `${contact.base64}:${msg.tx}`, result );
  }

  /**
   * @param  {Contact}  contact
   * @param  {Function} onReply
   * @param  {Function} onTimeout
   */
  ping( contact, onReply, onTimeout ) {
    contact.ping( this, onReply, onTimeout );
  }

  /**
   * @param  {Contact}  contact
   * @param  {Id}       target
   * @param  {Function} cb
   */
  find( contact, target, cb ) {
    const contacts = [];
    const queue = [];
    const callback = result => {
      contacts.push( contact );
      if ( result instanceof Contact ) {
        if ( result.id.equal( target ) ) {
          return cb( result );
        }
      }
      if ( result instanceof Array ) {
        queue.push( ...result );
        queue.sort( ( a, b ) => {
          const diff1 = a.id.difference( target );
          const diff2 = b.id.difference( target );
          return diff1.compare( diff2 );
        });
      }
      contact = queue.shift();
      if ( contact === undefined ) {
        contacts.sort( ( a, b ) => {
          const diff1 = a.id.difference( target );
          const diff2 = b.id.difference( target );
          return diff1.compare( diff2 );
        });
        return cb( contacts.slice( 0, 8 ) );
      }
      contact.find( this, target, callback );
    };
    contact.find( this, target, callback );
  }

  send( msg, port, host ) {
    this.socket.send( msg, port, host );
  }

  /**
   * @param  {Contact}  contact
   * @param  {Function} cb
   */
  update( contact, cb ) {
    this.routingTable.update( contact, this, cb );
  }
}

module.exports = Server;
