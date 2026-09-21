import { describe, expect, it } from 'vitest';
import { canViewMeetingMinute, visibleMeetingMinutes } from '@/lib/meeting-minutes/access';
import { MOCK_MEETING_MINUTES, MOCK_USERS } from '@/lib/mock-data';
import type { MinuteAccessRequest, SessionUser } from '@/types';

const employee: SessionUser = {
  ...MOCK_USERS[0], display_name: MOCK_USERS[0].full_name, company_name: 'デモ株式会社',
};
const admin: SessionUser = {
  ...MOCK_USERS[3], display_name: MOCK_USERS[3].full_name, company_name: 'デモ株式会社',
};
const salesMinute = MOCK_MEETING_MINUTES[0];
const developmentMinute = MOCK_MEETING_MINUTES[1];

function approvedRequest(): MinuteAccessRequest {
  return {
    id: 'request-1', company_id: employee.company_id,
    minute_id: developmentMinute.id, minute_title: developmentMinute.title,
    requester_id: employee.id, requester_name: employee.full_name,
    requester_department_id: employee.department_id,
    requester_department_name: employee.department_name,
    target_department_id: developmentMinute.department_id,
    target_department_name: developmentMinute.department_name,
    reason: '営業承認の待ち時間を開発部の自動化事例で改善するため',
    status: 'approved', requested_at: '2026-09-20T00:00:00Z',
    reviewed_by: admin.id, reviewed_by_name: admin.full_name,
    reviewed_at: '2026-09-20T01:00:00Z',
  };
}

describe('meeting minute access', () => {
  it('lets an employee view only their department by default', () => {
    expect(canViewMeetingMinute(employee, salesMinute, [])).toBe(true);
    expect(canViewMeetingMinute(employee, developmentMinute, [])).toBe(false);
    expect(visibleMeetingMinutes(employee, MOCK_MEETING_MINUTES, [])).toEqual([salesMinute]);
  });

  it('lets only the approved requester view the requested minute', () => {
    const request = approvedRequest();
    expect(canViewMeetingMinute(employee, developmentMinute, [request])).toBe(true);
    expect(canViewMeetingMinute({ ...employee, id: 'user-other' }, developmentMinute, [request])).toBe(false);
  });

  it('does not grant access for a pending or rejected request', () => {
    expect(canViewMeetingMinute(employee, developmentMinute, [{ ...approvedRequest(), status: 'pending' }])).toBe(false);
    expect(canViewMeetingMinute(employee, developmentMinute, [{ ...approvedRequest(), status: 'rejected' }])).toBe(false);
  });

  it('lets company administrators review all company minutes', () => {
    expect(visibleMeetingMinutes(admin, MOCK_MEETING_MINUTES, [])).toHaveLength(MOCK_MEETING_MINUTES.length);
  });

  it('never exposes another company minute', () => {
    expect(canViewMeetingMinute(admin, { ...salesMinute, company_id: 'other-company' }, [])).toBe(false);
  });
});
