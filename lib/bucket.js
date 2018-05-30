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
  }

  get badContact() {
    return this.contacts.find( contact => contact.isBad );
  }

  /**
   * @member {boolean}
   */
  get full() {
    return this.contacts.length === 8;
  }

  /**
   * @param {Contact} contact
   */
  addContact( contact ) {
    this.contacts.push( contact );
  }

  /**
   * @param  {Id}     id
   * @return {boolean}
   */
  belongs( id ) {
    return this.min.compare( id ) <= 0 && this.max.compare( id ) === 1;
  }

  /**
   * @param  {Bucket} bucket
   * @return {number}
   */
  compare( bucket ) {
    return this.min.compare( bucket.min );
  }

  /**
   * @param  {Id}                  id
   * @return {(Contact|undefined)}
   */
  getContact( id ) {
    return this.contacts.find( contact => contact.id.equal( id ) );
  }

  /**
   * @param  {Id}         id
   * @return {Contact[]}
   */
  getOtherContacts( id ) {
    return this.contacts.filter( contact => !contact.id.equal( id ) );
  }

  /**
   * @param  {Id}
   * @return {boolean}
   */
  hasContact( id ) {
    return this.getContact( id ) !== undefined;
  }

  /**
   * @param  {Id} id
   */
  removeContact( id ) {
    this.contacts = this.getOtherContacts( id );
  }

  /**
   * @param  {Contact} oldContact
   * @param  {Contact} newContact
   */
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

  /**
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
   * @param  {Server}   server
   * @param  {Function} cb
   */
  refresh( server, cb ) {
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
   * @param  {Contact}      contact
   * @param  {Server}       server
   * @param  {Function}     cb
   */
  update( contact, server, cb ) {
    if ( this.hasContact( contact.id ) ) {
      return cb( true );
    }
    if ( !this.full ) {
      this.addContact( contact );
      return cb( true );
    }
    this.sortContacts();
    let c = this.badContact;
    if ( c !== undefined ) {
      this.replaceContact( c, contact );
      return cb( true );
    }
    this.refresh( server, () => {
      c = this.badContact;
      if ( c !== undefined ) {
        this.replaceContact( c, contact );
        return cb( true );
      }
      this.refresh( server, () => {
        c = this.badContact;
        if ( c !== undefined ) {
          this.replaceContact( c, contact );
          return cb( true );
        }
        cb( false );
      });
    });
  }
}

module.exports = Bucket;
