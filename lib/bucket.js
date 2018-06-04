'use strict';

const Id = require('./id');

class Bucket {
  /**
   * constructor
   * @param {Object} [config = {}]
   * @param {Id}     [config.min = Id.zero()]
   * @param {Id}     [config.range = Id.range()]
   */
  constructor({ min = Id.zero(), range = Id.range() } = {}) {
    this.contacts = [];
    this.max = min.add( range );
    this.min = min;
    this.range = range;
    this.updated = Date.now();
  }

  /**
   * Merges the bucket with another bucket.
   * Returns a boolean indicating whether the merge was successful.
   *
   * @param  {Bucket}   bucket
   * @return {boolean}
   */
  merge( bucket ) {
    if ( this.min.equal( bucket.max ) ) {
      this.min = bucket.min;
    } else if ( this.max.equal( bucket.min ) ) {
      this.max = bucket.max;
    } else {
      return false;
    }
    this.range = this.range.add( bucket.range );
    this.contacts.push( ...bucket.contacts );
    return true;
  }

  /**
   * Pings contacts in the bucket that are questionable
   * or haven't been heard recently.
   *
   * @param  {Server}     server
   * @param  {Function}   cb
   */
  ping( server, cb ) {
    const contacts = this.contacts.filter( contact => {
      return contact.isQuestionable || contact.isOverdue;
    });
    if ( contacts.length === 0 ) {
      return cb();
    }
    let count = 0;
    contacts.forEach( c => {
      c.ping( server, () => {
        if ( ++count === contacts.length ) {
          cb();
        }
      });
    });
  }

  /**
   * Splits the bucket into two buckets and returns the other bucket.
   *
   * @return {Bucket}
   */
  split() {
    const range = this.range.halve();
    const bucket = new Bucket({ min: this.min, range });
    this.min = bucket.max;
    this.range = range;
    const contacts = this.contacts.slice( 0 );
    this.contacts = [];
    contacts.forEach( contact => {
      if ( this.belongs( contact.id ) ) {
        this.contacts.push( contact );
      } else {
        bucket.contacts.push( contact );
      }
    });
    return bucket;
  }

  /**
   * Updates the contact in the bucket.
   * Calls the callback with a boolean indicating
   * whether the updated contact is now in the bucket.
   *
   * @param  {Contact}      contact
   * @param  {Server}       server
   * @param  {Function}     cb
   */
  update( contact, server, cb ) {
    let c = this.getContact( contact.id );
    if ( c !== undefined ) {
      c.update( contact.lastHeard );
      return cb( true );
    }
    if ( !this.full ) {
      this.addContact( contact );
      return cb( true );
    }
    this.sortContacts();
    c = this.badContact;
    if ( c !== undefined ) {
      this.replaceContact( c, contact );
      return cb( true );
    }
    this.ping( server, () => {
      c = this.badContact;
      if ( c !== undefined ) {
        this.replaceContact( c, contact );
        return cb( true );
      }
      this.ping( server, () => {
        c = this.badContact;
        if ( c !== undefined ) {
          this.replaceContact( c, contact );
          return cb( true );
        }
        cb( false );
      });
    });
  }

  static get maxContacts() {
    return 8;
  }

  get badContact() {
    return this.contacts.find( contact => contact.isBad );
  }

  get randomContact() {
    if ( this.contacts.length === 0 ) {
      return undefined;
    }
    const index = Math.floor( Math.random() * this.contacts.length );
    return this.contacts[ index ];
  }

  get full() {
    return this.contacts.length === Bucket.maxContacts;
  }

  addContact( contact ) {
    this.contacts.push( contact );
  }

  belongs( id ) {
    return this.min.compare( id ) <= 0 && this.max.compare( id ) === 1;
  }

  compare( bucket ) {
    return this.min.compare( bucket.min );
  }

  getContact( id ) {
    return this.contacts.find( contact => contact.id.equal( id ) );
  }

  getOtherContacts( id ) {
    return this.contacts.filter( contact => !contact.id.equal( id ) );
  }

  hasContact( id ) {
    return this.getContact( id ) !== undefined;
  }

  removeContact( id ) {
    this.contacts = this.getOtherContacts( id );
  }

  replaceContact( oldContact, newContact ) {
    this.removeContact( oldContact.id );
    this.addContact( newContact );
  }

  sortContacts() {
    this.contacts.sort( ( a, b ) => {
      if ( a.lastHeard < b.lastHeard ) {
        return -1;
      }
      if ( a.lastHeard > b.lastHeard ) {
        return 1;
      }
      return 0;
    });
  }
}

module.exports = Bucket;
