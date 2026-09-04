import sqlite3
from pathlib import Path

schema=Path(__file__).resolve().parents[1]/"src/lib/db/schema.sql"
con=sqlite3.connect(":memory:")
con.executescript(schema.read_text())
# seed
con.execute("insert into users(id,username,password_hash,pin_hash,name,role) values('u','admin','x','salt:hash','مدير','admin')")
con.execute("insert into categories(id,name) values('c','ملابس')")
con.execute("insert into products(id,name,category_id) values('p','تيشيرت','c')")
con.execute("insert into product_variants(id,product_id,sku,sell_price,cost_price,quantity) values('v','p','T-1',100,60,10)")
con.execute("insert into customers(id,name,balance) values('cust','عميل',0)")
con.execute("insert into register_sessions(id,user_id,opening_float,status) values('rs','u',500,'open')")
# partial cash receivable
con.execute("insert into sales(id,invoice_no,user_id,customer_id,register_session_id,subtotal,total,paid,change,status) values('s','202601010001','u','cust','rs',100,100,60,0,'completed')")
con.execute("update customers set balance=balance+40 where id='cust'")
con.execute("insert into customer_ledger(id,customer_id,entry_type,reference_type,reference_id,debit) values('cl','cust','sale','sale','s',40)")
con.execute("insert into cash_ledger(id,register_session_id,user_id,entry_type,reference_type,reference_id,amount_in) values('cash','rs','u','SALE','sale','s',100)")
assert con.execute("select balance from customers where id='cust'").fetchone()[0]==40
assert con.execute("select amount_in-amount_out from cash_ledger where id='cash'").fetchone()[0]==100
assert con.execute("select current_value from document_sequences where document_type='SALE' and date_key='20260904'").fetchone() is None
print('business invariants: PASS')
print('tables:', con.execute("select count(*) from sqlite_master where type='table'").fetchone()[0])
