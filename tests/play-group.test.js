import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { createTestEnvironment, User, Facility, Court, Booking, SlotLock } from './helpers/database.js';
import { TestBrowser, bookingFromLocation } from './helpers/http.js';
import PlayGroup from '../models/PlayGroup.js';
import ExtraService from '../models/ExtraService.js';
import { createHold, simulatePayment, createChangeRequest, approveRequest } from '../services/booking.service.js';
import { createGroup, groupAction } from '../services/play-group.service.js';

test('Sân ghép và dịch vụ trên transaction thực, đầy đủ luồng và quyền', async t => {
 const env = await createTestEnvironment(); t.after(() => env.close());
 const password = 'GroupFixture2026!'; const passwordHash = await bcrypt.hash(password, 4);
 const [owner, creator, a, b] = await User.create([
  {fullName:'Chủ sân thử',email:'group-owner@example.test',passwordHash,role:'OWNER',ownerStatus:'APPROVED'},
  {fullName:'Người tạo',email:'group-creator@example.test',passwordHash},
  {fullName:'Bạn A',email:'group-a@example.test',passwordHash},
  {fullName:'Bạn B',email:'group-b@example.test',passwordHash}
 ]);
 const facility = await Facility.create({name:'Cơ sở thử',address:'Địa chỉ thử',phone:'0900000001',owner:owner._id});
 const court = await Court.create({name:'Sân thử',facility:facility._id,basePriceVND:100001,peakPriceVND:100001});
 const extra = await ExtraService.create({facility:facility._id,name:'Nước suối',unit:'chai',price:10000});
 const date = new Date(Date.now()+3*86400000+7*3600000).toISOString().slice(0,10);
 const held = await createHold({courtId:court.id,date,times:['08:00'],user:creator,guestPhone:'0900000002',extras:{['extra_'+extra.id]:'2'}});
 await simulatePayment(String(held.booking._id),{user:creator});
 const originalLocks=await SlotLock.find().lean();
 const body={bookingId:String(held.booking._id),title:'Giao lưu cầu lông',capacity:'2',closesAt:date+'T07:00',phone:'0900000002',consent:'yes'};
 await assert.rejects(createGroup(a,body),{status:403});
 const group=await createGroup(creator,body);
 await t.test('Chỉ trả tiền sân; dịch vụ lưu giá snapshot riêng',async()=>{
  const booking=await Booking.findById(held.booking._id);
  assert.equal(booking.totalPrice,100001);assert.equal(booking.extras[0].quantity,2);assert.equal(booking.extras[0].price,10000);
 });
 await t.test('Chống tranh chỗ cuối, không tạo lock sân thứ hai',async()=>{
  const result=await Promise.allSettled([groupAction(group.id,a,'join',{phone:'0900000003',['extra_'+extra.id]:'1'}),groupAction(group.id,b,'join',{phone:'0900000004'})]);
  assert.equal(result.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(result.filter(x=>x.status==='rejected' && x.reason.status===409).length,1);
  assert.equal((await PlayGroup.findById(group.id)).members.length,2);
  assert.deepEqual(await SlotLock.find().lean(),originalLocks);
 });
 await t.test('Không tự rời; chỉ người tạo được xóa trước khi chốt',async()=>{
  const current=await PlayGroup.findById(group.id);const member=current.members[1];
  await assert.rejects(groupAction(group.id,a,'remove',{memberId:String(member.user)}),{status:403});
  await groupAction(group.id,creator,'remove',{memberId:String(member.user)});
  assert.equal((await PlayGroup.findById(group.id)).members.length,1);
  await groupAction(group.id,a,'join',{phone:'0900000003',['extra_'+extra.id]:'1'});
 });
 await t.test('HTTP: riêng tư thông tin liên hệ, form hoạt động, CSRF',async()=>{
  const guest=new TestBrowser(env.base); const page=await guest.get('/groups/'+group.id);
  assert.equal(page.status,200,page.html);assert.ok(!page.html.includes('0900000002'));assert.ok(!page.html.includes('0900000003'));
  const c=new TestBrowser(env.base);await c.login(creator.email,password);
  assert.equal((await c.get('/groups/new')).status,200);
  assert.equal((await c.get('/groups?mine=1')).status,200);
  assert.equal((await c.post('/groups/'+group.id+'/close',{}, {csrf:false})).status,403);
  assert.equal((await c.get('/owner/extras')).status,403);
  const o=new TestBrowser(env.base);await o.login(owner.email,password);
  assert.equal((await o.get('/owner/extras')).status,200);
  const courtPage=await guest.get('/courts/'+court.id+'?date='+date);assert.ok(courtPage.html.includes('Nước suối'));
  const hold=await guest.hold({courtId:court.id,date,times:['09:00'],guestName:'Khách thử',guestPhone:'0900000005',['extra_'+extra.id]:'3'});
  assert.equal(hold.status,303,hold.html);
  const checkout=await guest.get(bookingFromLocation(hold.location).checkout);assert.ok(checkout.html.includes('Nước suối'));
 });
 await t.test('Chốt tiền lẻ đúng tổng, không thêm/xóa sau khi chốt',async()=>{
  await groupAction(group.id,creator,'close');
  const result=await PlayGroup.findById(group.id);assert.equal(result.members.reduce((s,m)=>s+m.share,0),100001);
  await assert.rejects(groupAction(group.id,b,'join',{phone:'0900000004'}),{status:409});
  await assert.rejects(groupAction(group.id,creator,'remove',{memberId:a.id}),{status:409});
 });
 await t.test('Đúng hạn tự chốt dù chỉ một người; join muộn không thay danh sách',async()=>{
  const hold=await createHold({courtId:court.id,date,times:['11:00'],user:creator,guestPhone:'0900000002'});
  await simulatePayment(String(hold.booking._id),{user:creator});
  const another=await createGroup(creator,{...body,bookingId:String(hold.booking._id)});
  await PlayGroup.updateOne({_id:another._id},{$set:{closesAt:new Date(Date.now()-1000)}});
  await assert.rejects(groupAction(another.id,b,'join',{phone:'0900000004'}),{status:409});
  await groupAction(another.id,null,'refresh');
  const closed=await PlayGroup.findById(another.id);assert.ok(closed.closedAt);assert.equal(closed.members.length,1);assert.equal(closed.members[0].share,100001);
 });
 await t.test('Chọn sân ghép ngay khi đặt dẫn sang form tạo nhóm sau mô phỏng',async()=>{
  const c=new TestBrowser(env.base);await c.login(creator.email,password);
  const held=await c.hold({courtId:court.id,date,times:['12:00'],guestName:creator.fullName,guestPhone:'0900000002',bookingStyle:'group'});
  const item=bookingFromLocation(held.location);
  const paid=await c.post('/bookings/'+item.id+'/demo-payment');
  assert.equal(paid.status,303,paid.html);assert.equal(paid.location,'/groups/new?booking='+item.id);
  const form=await c.get(paid.location);assert.equal(form.status,200,form.html);assert.ok(form.html.includes('value="'+item.id+'" selected'));
 });
 await t.test('Nhóm có thành viên không được đổi lịch; hủy phải chờ chủ sân',async()=>{
  await assert.rejects(createChangeRequest(String(held.booking._id),creator,{type:'CHANGE',reason:'Đổi thử',requestedCourt:court.id,requestedDate:date,requestedTimes:['10:00']}),{status:409});
  const request=await createChangeRequest(String(held.booking._id),creator,{type:'CANCEL',reason:'Xin hủy buổi'});
  await approveRequest(String(request._id),owner,{refundAmount:'0'});
  const viewer=new TestBrowser(env.base);const cancelled=await viewer.get('/groups/'+group.id);
  assert.equal(cancelled.status,200,cancelled.html);assert.match(cancelled.html,/BUỔI CHƠI ĐÃ HỦY/);
  assert.equal(await SlotLock.countDocuments({booking:held.booking._id}),0);
 });
});
