'use strict';

const Bucket = require('./bucket');

class RoutingTable {
  constructor() {
    this.buckets = [ new Bucket() ];
  }

  /**
   * Returns the contact with the given id.
   * If the contact is not found, it returns
   * up to the 8 closest contacts it can find.
   *
   * @param  {Id}                   id
   * @return {(Contact|Contact[])}
   */
  find( id ) {
    const contact = this.getContact( id );
    if ( contact !== undefined ) {
      return contact;
    }
    const contacts = this.contacts;
    contacts.sort( ( a, b ) => {
      const diff1 = a.id.difference( id );
      const diff2 = b.id.difference( id );
      return diff1.compare( diff2 );
    });
    return contacts.slice( 0, Bucket.maxContacts );
  }

  /**
   * Updates the contact in the routing table.
   * Calls the callback with a boolean indicating
   * whether the updated contact is now in the routing table.
   *
   * @param {Contact}            contact
   * @param {Server}             server
   * @param {Function(boolean)}  cb
   */
  update( contact, server, cb ) {
    const bucket = this.getBucket( contact.id );
    bucket.update( contact, server, success => {
      if ( success ) {
        return cb( true );
      }
      if ( !bucket.belongs( server.id ) ) {
        return cb( false );
      }
      this.buckets.push( bucket.split() );
      this.update( contact, server, cb );
    });
  }

  get contacts() {
    return this.buckets.reduce( ( acc, bucket ) => {
      return acc.concat( bucket.contacts );
    }, [] );
  }

  getBucket( id ) {
    return this.buckets.find( bucket => bucket.belongs( id ) );
  }

  getContact( id ) {
    return this.getBucket( id ).getContact( id );
  }

  hasContact( id ) {
    return this.getBucket( id ).hasContact( id );
  }
}

module.exports = RoutingTable;
