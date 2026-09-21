import type { MeetingMinute, MinuteAccessRequest, SessionUser } from '@/types';

function isCompanyAdmin(user: SessionUser): boolean {
  return user.role === 'admin' || user.role === 'super_admin';
}

function companyIdFor(user: SessionUser): string {
  return user.tenant_company_id ?? user.company_id;
}

export function approvedMinuteIds(
  user: SessionUser,
  requests: MinuteAccessRequest[]
): Set<string> {
  return new Set(
    requests
      .filter(
        (request) =>
          request.company_id === companyIdFor(user) &&
          request.requester_id === user.id &&
          request.status === 'approved'
      )
      .map((request) => request.minute_id)
  );
}

export function canViewMeetingMinute(
  user: SessionUser,
  minute: MeetingMinute,
  requests: MinuteAccessRequest[]
): boolean {
  if (minute.company_id !== companyIdFor(user)) return false;
  if (isCompanyAdmin(user)) return true;
  if (user.department_id && minute.department_id === user.department_id) return true;
  return approvedMinuteIds(user, requests).has(minute.id);
}

export function visibleMeetingMinutes(
  user: SessionUser,
  minutes: MeetingMinute[],
  requests: MinuteAccessRequest[]
): MeetingMinute[] {
  return minutes.filter((minute) => canViewMeetingMinute(user, minute, requests));
}

export function requestForMinute(
  user: SessionUser,
  minuteId: string,
  requests: MinuteAccessRequest[]
): MinuteAccessRequest | undefined {
  return requests
    .filter(
      (request) =>
        request.company_id === companyIdFor(user) &&
        request.requester_id === user.id &&
        request.minute_id === minuteId
    )
    .sort((a, b) => b.requested_at.localeCompare(a.requested_at))[0];
}
