import test from 'node:test';
import assert from 'node:assert/strict';
import User from '../models/User.js';
import { unlockUser, verifyUserEmail } from '../controllers/admin.controller.js';

function createMockRes() {
  const state = { statusCode: 200, view: null, data: null, redirected: null };
  const res = {
    status(code) { state.statusCode = code; return res; },
    render(view, data) { state.view = view; state.data = data; return res; },
    redirect(code, url) { state.statusCode = code; state.redirected = url; return res; }
  };
  return { res, state };
}

test('Admin mở khóa tài khoản bị khóa đăng nhập và từ chối ObjectId sai', async t => {
  const id = '507f1f77bcf86cd799439051';
  let capturedUpdate = null;
  t.mock.method(User, 'findByIdAndUpdate', async (targetId, update) => {
    assert.equal(targetId, id);
    capturedUpdate = update;
    return { _id: id, email: 'locked-user@example.com' };
  });

  const req = { params: { id }, session: {} };
  const { res, state } = createMockRes();
  await unlockUser(req, res);

  assert.equal(state.statusCode, 303);
  assert.equal(state.redirected, '/admin?tab=users');
  assert.deepEqual(capturedUpdate.$set, { failedLoginAttempts: 0, loginLockedUntil: null });
  assert.match(req.session.adminSuccessMessage, /locked-user@example\.com/);

  const bad = createMockRes();
  await unlockUser({ params: { id: 'not-an-id' }, session: {} }, bad.res);
  assert.equal(bad.state.statusCode, 400);
});

test('Admin xác nhận email thủ công cho tài khoản khách', async t => {
  const id = '507f1f77bcf86cd799439052';
  let capturedUpdate = null;
  t.mock.method(User, 'findByIdAndUpdate', async (targetId, update) => {
    assert.equal(targetId, id);
    capturedUpdate = update;
    return { _id: id, email: 'verify-me@example.com' };
  });

  const req = { params: { id }, session: {} };
  const { res, state } = createMockRes();
  await verifyUserEmail(req, res);

  assert.equal(state.statusCode, 303);
  assert.equal(state.redirected, '/admin?tab=users');
  assert.deepEqual(capturedUpdate.$set, {
    emailVerified: true,
    emailVerifyTokenHash: null,
    emailVerifyExpiresAt: null
  });
  assert.match(req.session.adminSuccessMessage, /verify-me@example\.com/);
});
