'use strict';

exports.fill = ( value, length ) => Array( length ).fill( value );

exports.parse = msg => JSON.parse( msg.toString() );

exports.replicate = ( f, length ) => Array.from({ length }, f );
