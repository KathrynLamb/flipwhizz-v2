// tests/checkout-store.integration.test.ts
// TEST_DATABASE_URL must be an isolated test DB. Creates and removes its own schema.
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { getTableConfig } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";
import { createCheckoutStore } from "../src/lib/checkout/store";
import { stories, storyProducts, promoCodes, checkoutPayments } from "../src/db/schema";
import { christmasPromoSeedSQL } from "../scripts/seed-christmas-promos";
type DB = Parameters<typeof createCheckoutStore>[0];
export async function prepareCheckoutTestDatabase(exec: (query: string) => Promise<unknown>) {
  for (const table of [stories,storyProducts,promoCodes]) {
    const t=getTableConfig(table);
    await exec(`CREATE TABLE "${t.name}" (${t.columns.map(c=>`"${c.name}" ${c.getSQLType()}${c.primary?' PRIMARY KEY':''}`).join(',')})`);
  }
  await exec("ALTER TABLE promo_codes ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN current_uses SET DEFAULT 0");
  await exec(readFileSync(new URL("../scripts/sql/christmas-checkout.sql",import.meta.url),"utf8"));
}
export async function verifyCheckoutStore(db: DB) {
  const store=createCheckoutStore(db);
  async function story() {
    const id=randomUUID();
    await db.insert(stories).values({id,projectId:randomUUID(),title:"Test",bookType:"storybook",paymentStatus:"pending"});
    await db.insert(storyProducts).values({id:randomUUID(),storyId:id,productType:"digital",currency:"GBP"});
    return id;
  }
  async function fixture(max=1,perUser:number|null=null,percent=100) {
    const id=randomUUID(),code=`TEST${id.slice(0,8)}`,storyId=await story();
    await db.insert(promoCodes).values({id,code,active:true,currentUses:0,maxUses:max,maxUsesPerUser:perUser,discountPercent:percent});
    return {id,code,storyId};
  }
  async function quote(f:Awaited<ReturnType<typeof fixture>>,userId="buyer") {
    const id=randomUUID();
    await db.insert(checkoutPayments).values({id,storyId:f.storyId,userId,productType:"digital",bookType:"storybook",currency:"GBP",amountCents:100,promoId:f.id,promoCode:f.code});return id;
  }
  const uses=async(id:string)=>(await db.select().from(promoCodes).where(eq(promoCodes.id,id)))[0].currentUses;
  const a=await fixture(), a1=await quote(a),a2=await quote(a);
  const results=await Promise.allSettled([store.reserve(a1,"buyer"),store.reserve(a2,"buyer")]);
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1,"one final use");
  const winner=results[0].status==="fulfilled"?a1:a2;
  await store.reserve(winner,"buyer");await store.complete(winner,"buyer",null);await store.complete(winner,"buyer",null);
  assert.equal(await uses(a.id),1,"retries count once");
  assert.equal((await db.select().from(checkoutPayments).where(eq(checkoutPayments.id,winner)))[0].promoCode,a.code);
  await assert.rejects(store.reserve(winner,"other"),/refresh checkout/);
  const b=await fixture();const free=await store.claimFree(b.storyId,"buyer",b.code.toLowerCase());
  assert.equal(free.payment?.amountCents,0);assert.equal(free.payment?.currency,"GBP");
  assert.equal((await store.claimFree(b.storyId,"buyer",b.code)).alreadyPaid,true);assert.equal(await uses(b.id),1);
  const second=await story();await assert.rejects(store.claimFree(second,"buyer",b.code),/fully redeemed/);
  assert.equal((await db.select().from(stories).where(eq(stories.id,second)))[0].paymentStatus,"pending");
  const c=await fixture(1,null,10);await assert.rejects(store.claimFree(c.storyId,"buyer",c.code),/does not make this product free/);assert.equal(await uses(c.id),0,"rollback counter");
  const d=await fixture(10,1);await store.reserve(await quote(d),"buyer");await assert.rejects(store.reserve(await quote(d),"buyer"),/maximum number/);await store.reserve(await quote(d,"other"),"other");assert.equal(await uses(d.id),2);
  for(const change of [{active:false},{expiresAt:new Date(0)},{startsAt:new Date("2099-01-01")}]) {
    const f=await fixture();await db.update(promoCodes).set(change).where(eq(promoCodes.id,f.id));await assert.rejects(store.reserve(await quote(f),"buyer"));assert.equal(await uses(f.id),0);
  }
  const e=await fixture(),e1=await quote(e);await store.reserve(e1,"buyer");await db.update(promoCodes).set({expiresAt:new Date(0)}).where(eq(promoCodes.id,e.id));await store.reserve(e1,"buyer");await store.cancelVoided(e1,"buyer");await store.cancelVoided(e1,"buyer");assert.equal(await uses(e.id),0);await assert.rejects(store.reserve(e1,"buyer"),/cancelled/);
  console.log("Checkout assertions passed: final-use contention, retries, free claims, rollback, user limits, validity and cancellation.");
}
test("checkout transactions in isolated PostgreSQL",{skip:!process.env.TEST_DATABASE_URL},async()=>{
  const {default:postgres}=await import("postgres");const {drizzle}=await import("drizzle-orm/postgres-js");
  const name=`checkout_test_${randomUUID().replaceAll('-','')}`;const admin=postgres(process.env.TEST_DATABASE_URL!,{max:1});await admin`CREATE SCHEMA ${admin(name)}`;
  const client=postgres(process.env.TEST_DATABASE_URL!,{max:5,connection:{search_path:name}});
  try {
    await prepareCheckoutTestDatabase(q=>client.unsafe(q));await verifyCheckoutStore(drizzle(client) as DB);
    await client.unsafe(christmasPromoSeedSQL());await client`UPDATE promo_codes SET current_uses=7 WHERE code='CHRISTMAS10'`;await client.unsafe(christmasPromoSeedSQL());assert.equal((await client`SELECT current_uses FROM promo_codes WHERE code='CHRISTMAS10'`)[0].current_uses,7);
  } finally {await client.end();await admin`DROP SCHEMA ${admin(name)} CASCADE`;await admin.end();}
});
