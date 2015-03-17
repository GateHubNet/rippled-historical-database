var Aggregation  = require('../src/lib/accountPaymentsAggregation');
var Parser       = require('../src/lib/modules/ledgerParser');
var Hbase        = require('../src/lib/hbase-client');
var utils        = require('../src/lib/utils');
var fs           = require('fs');
var options = {
  "logLevel" : 4,
  "hbase" : {
    "prefix" : 'test_',
    "host"   : "54.172.205.78",
    "port"   : 9090
  },
  "ripple" : {
    "trace"                 : false,
    "allow_partial_history" : false,
    "servers" : [
      { "host" : "s-west.ripple.com", "port" : 443, "secure" : true },
      { "host" : "s-east.ripple.com", "port" : 443, "secure" : true }
    ]
  }
};

var payments     = new Aggregation(options);
var path         = __dirname + '/ledgers/';
var EPOCH_OFFSET = 946684800;
var files        = fs.readdirSync(path);
var ledgers      = [ ];

function prepareTransaction (ledger, tx) {
  var meta = tx.metaData;
  delete tx.metaData;

  tx.raw           = utils.toHex(tx);
  tx.meta          = utils.toHex(meta);
  tx.metaData      = meta;

  tx.ledger_hash   = ledger.ledger_hash;
  tx.ledger_index  = ledger.ledger_index;
  tx.executed_time = ledger.close_time;
  tx.tx_index      = tx.metaData.TransactionIndex;
  tx.tx_result     = tx.metaData.TransactionResult;

  return tx;
};

console.log('# ledgers:', files.length);

var count = 0;

files.forEach(function(filename) {
  var ledger = JSON.parse(fs.readFileSync(path + filename, "utf8"));

  //adjust the close time to unix epoch
  ledger.close_time = ledger.close_time + EPOCH_OFFSET;

  setTimeout(function() {
    console.log("processing ledger:", ledger.ledger_index);
    processLedger(ledger);
  }, count++ * 500);
});

function processLedger (ledger) {

  ledger.transactions.forEach(function(tx) {
    var parsed;

    tx     = prepareTransaction(ledger, tx);
    parsed = Parser.parseTransaction(tx);

    if (parsed.payments.length) {
      payments.add({
        data    : parsed.payments[0],
        account : parsed.payments[0].source
      });

      payments.add({
        data    : parsed.payments[0],
        account : parsed.payments[0].destination
      });
    }
  });
}