import {test} from 'node:test';
import assert from 'node:assert/strict';
import {closestSeat,mealTurn,biteMotion} from '../src/story/dining.ts';
import {plateGeometry,freePlateSlot} from '../src/story/plating.ts';
test('dining picks the nearest empty cushion and shares each real piece once',()=>{
 assert.equal(closestSeat(156),0);assert.equal(closestSeat(212),1);
 assert.equal(closestSeat(156,0),1);assert.equal(closestSeat(212,1),0);
 assert.deepEqual([0,1,2].map(i=>mealTurn(i,true)),['player','guest','offer']);
 assert.deepEqual([0,1,2].map(i=>mealTurn(i,false)),['player','player','player']);
 const points=[[0,0],[10,-10],[40,-10],[20,-4]] as [number,number][];
 const offered=biteMotion(1.1,'offer',...points as [typeof points[0],typeof points[0],typeof points[0],typeof points[0]]);
 assert(offered.playerHand&&offered.guestHand,'both hands meet over the same final piece');
 const final=biteMotion(2.72,'offer',...points as [typeof points[0],typeof points[0],typeof points[0],typeof points[0]]);
 assert(final.done);assert.equal(final.bite,1);assert.deepEqual(final.food,points[2]);
});
test('plate arrangements keep all sushi on the plate and prevent double booking',()=>{
 for(const portrait of[true,false])for(const pattern of['row','triangle'] as const){
  const {plate,slots}=plateGeometry(portrait,pattern);
  slots.forEach((p,i)=>{assert(p[0]-21>=plate.x&&p[0]+21<=plate.x+plate.w);assert(p[1]>=plate.y&&p[1]<=plate.y+plate.h);assert.equal(freePlateSlot(p,slots,[]),i);assert.equal(freePlateSlot(p,slots,[i]),-1);});
  assert.equal(freePlateSlot([0,0],slots,[]),-1);
 }
});
