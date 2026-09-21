'use client';

import { useState } from 'react';
import { CalendarDays, Eye, FilePlus2, LockKeyhole, Send } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useRepositoryData } from '@/lib/hooks/use-repository-data';
import {
  createMeetingMinute,
  createMinuteAccessRequest,
  fetchDepartments,
  fetchMeetingMinutes,
  fetchMinuteAccessRequests,
} from '@/lib/repositories';
import {
  canViewMeetingMinute,
  requestForMinute,
} from '@/lib/meeting-minutes/access';
import {
  MOCK_DEPARTMENTS,
  MOCK_MEETING_MINUTES,
  MOCK_MINUTE_ACCESS_REQUESTS,
} from '@/lib/mock-data';
import { filterByCompany } from '@/lib/tenant/filter';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Input';
import { DataLoadError } from '@/components/ui/DataLoadError';
import type { MeetingMinute } from '@/types';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function MeetingMinutesPage() {
  const { user, effectiveCompanyId } = useAuth();
  const { data: minutes, loading, error: minutesError, reload: reloadMinutes, setData: setMinutes } =
    useRepositoryData(
      `meeting-minutes-${effectiveCompanyId}`,
      () => fetchMeetingMinutes(effectiveCompanyId),
      filterByCompany(MOCK_MEETING_MINUTES, effectiveCompanyId),
      { persistMock: true, configuredInitial: [] }
    );
  const { data: requests, error: requestsError, reload: reloadRequests, setData: setRequests } =
    useRepositoryData(
      `minute-access-requests-${effectiveCompanyId}`,
      () => fetchMinuteAccessRequests(effectiveCompanyId),
      filterByCompany(MOCK_MINUTE_ACCESS_REQUESTS, effectiveCompanyId),
      { persistMock: true, configuredInitial: [] }
    );
  const { data: departments } = useRepositoryData(
    `minute-departments-${effectiveCompanyId}`,
    () => fetchDepartments(effectiveCompanyId),
    filterByCompany(MOCK_DEPARTMENTS, effectiveCompanyId),
    { configuredInitial: [] }
  );

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState(today);
  const [departmentId, setDepartmentId] = useState(user?.department_id ?? '');
  const [participants, setParticipants] = useState('');
  const [agenda, setAgenda] = useState('');
  const [decisions, setDecisions] = useState('');
  const [actionItems, setActionItems] = useState('');
  const [requestingMinute, setRequestingMinute] = useState<MeetingMinute | null>(null);
  const [requestReason, setRequestReason] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!user) return null;

  const isAdmin = user.role === 'admin' || user.role === 'super_admin';
  const ownDepartmentId = user.department_id;
  const effectiveDepartmentId = isAdmin ? departmentId : ownDepartmentId ?? '';
  const departmentName = (id: string) =>
    departments.find((department) => department.id === id)?.name ?? '部署未設定';

  const resetForm = () => {
    setTitle('');
    setMeetingDate(today());
    setParticipants('');
    setAgenda('');
    setDecisions('');
    setActionItems('');
    setShowForm(false);
  };

  const saveMinute = async () => {
    if (!effectiveDepartmentId || !title.trim() || !agenda.trim() || !decisions.trim()) {
      setMessage('部署・題名・議題・決定事項を入力してください。');
      return;
    }
    setSubmitting(true);
    setMessage('');
    const created = await createMeetingMinute({
      company_id: effectiveCompanyId,
      title: title.trim(),
      meeting_date: meetingDate,
      department_id: effectiveDepartmentId,
      participants: participants.trim(),
      agenda: agenda.trim(),
      decisions: decisions.trim(),
      action_items: actionItems.trim(),
      created_by: user.id,
    });
    setSubmitting(false);
    if (!created) {
      setMessage('議事録を登録できませんでした。');
      return;
    }
    setMinutes((current) => [
      {
        ...created,
        department_name: departmentName(effectiveDepartmentId),
        created_by_name: user.full_name,
      },
      ...current,
    ]);
    setMessage('議事録を登録しました。自部署の社員が閲覧できます。');
    resetForm();
  };

  const submitAccessRequest = async () => {
    if (!requestingMinute || requestReason.trim().length < 5) {
      setMessage('閲覧が必要な理由を5文字以上で入力してください。');
      return;
    }
    const created = await createMinuteAccessRequest({
      company_id: effectiveCompanyId,
      minute_id: requestingMinute.id,
      minute_title: requestingMinute.title,
      requester_id: user.id,
      requester_name: user.full_name,
      requester_department_id: user.department_id,
      requester_department_name: user.department_name,
      target_department_id: requestingMinute.department_id,
      target_department_name: requestingMinute.department_name,
      reason: requestReason.trim(),
    });
    if (!created) {
      setMessage('閲覧申請を送信できませんでした。');
      return;
    }
    setRequests((current) => [created, ...current]);
    setRequestingMinute(null);
    setRequestReason('');
    setMessage('管理者へ閲覧申請を送りました。承認後に本文を確認できます。');
  };

  const repositoryError = minutesError || requestsError;

  return (
    <div>
      <PageHeader
        title="会議議事録"
        description="全社員が自部署の知見を記録し、他部署の内容は承認を受けて安全に共有します"
        action={
          <Button onClick={() => setShowForm((current) => !current)} disabled={!isAdmin && !ownDepartmentId}>
            <FilePlus2 className="h-4 w-4" />
            議事録を追加
          </Button>
        }
      />

      {!isAdmin && !ownDepartmentId && (
        <Card className="mb-5 border-amber-200 bg-amber-50">
          <CardBody className="text-sm text-amber-900">
            所属部署が未設定のため登録できません。管理者へ部署設定を依頼してください。
          </CardBody>
        </Card>
      )}

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <Card><CardBody><p className="font-semibold">全社員が記録</p><p className="mt-1 text-sm text-slate-500">会議の議題・決定事項・担当作業を残します。</p></CardBody></Card>
        <Card><CardBody><p className="font-semibold">本文は部署単位</p><p className="mt-1 text-sm text-slate-500">通常は自部署の議事録だけを閲覧できます。</p></CardBody></Card>
        <Card><CardBody><p className="font-semibold">他部署は申請制</p><p className="mt-1 text-sm text-slate-500">目的を明記し、管理者の承認後に閲覧できます。</p></CardBody></Card>
      </div>

      {message && <p role="status" className="mb-5 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-900">{message}</p>}
      {repositoryError && (
        <DataLoadError message={repositoryError} onRetry={() => void Promise.all([reloadMinutes(), reloadRequests()])} />
      )}

      {showForm && (
        <Card className="mb-6">
          <CardBody className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="minute-title">会議名</Label>
              <Input id="minute-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例: 営業部 週次改善会議" />
            </div>
            <div>
              <Label htmlFor="meeting-date">開催日</Label>
              <Input id="meeting-date" type="date" value={meetingDate} onChange={(event) => setMeetingDate(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="minute-department">担当部署</Label>
              {isAdmin ? (
                <Select id="minute-department" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
                  <option value="">選択してください</option>
                  {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </Select>
              ) : (
                <Input id="minute-department" value={user.department_name ?? '部署未設定'} disabled />
              )}
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="minute-participants">参加者</Label>
              <Input id="minute-participants" value={participants} onChange={(event) => setParticipants(event.target.value)} placeholder="氏名を読点区切りで入力" />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="minute-agenda">議題・課題</Label>
              <Textarea id="minute-agenda" rows={4} value={agenda} onChange={(event) => setAgenda(event.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="minute-decisions">決定事項</Label>
              <Textarea id="minute-decisions" rows={4} value={decisions} onChange={(event) => setDecisions(event.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="minute-actions">担当・期限</Label>
              <Textarea id="minute-actions" rows={3} value={actionItems} onChange={(event) => setActionItems(event.target.value)} placeholder="例: 山田: 見積フロー整理（9/30）" />
            </div>
            <div className="flex gap-2 md:col-span-2">
              <Button onClick={() => void saveMinute()} disabled={submitting}>{submitting ? '登録中...' : '登録する'}</Button>
              <Button variant="secondary" onClick={resetForm}>キャンセル</Button>
            </div>
          </CardBody>
        </Card>
      )}

      {requestingMinute && (
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardBody>
            <p className="font-semibold text-blue-950">「{requestingMinute.title}」の閲覧を申請</p>
            <p className="mt-1 text-sm text-blue-800">業務上必要な理由と、どの改善に活用するかを記入してください。</p>
            <div className="mt-3">
              <Label htmlFor="access-reason">申請理由</Label>
              <Textarea id="access-reason" rows={3} value={requestReason} onChange={(event) => setRequestReason(event.target.value)} placeholder="例: 営業の承認待ち時間を開発の自動化事例で改善するため" />
            </div>
            <div className="mt-3 flex gap-2">
              <Button onClick={() => void submitAccessRequest()}><Send className="h-4 w-4" />申請する</Button>
              <Button variant="secondary" onClick={() => setRequestingMinute(null)}>キャンセル</Button>
            </div>
          </CardBody>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">議事録を読み込んでいます...</p>
      ) : (
        <div className="space-y-4">
          {minutes.map((minute) => {
            const canView = canViewMeetingMinute(user, minute, requests);
            const accessRequest = requestForMinute(user, minute.id, requests);
            return (
              <Card key={minute.id} className={!canView ? 'bg-slate-50' : undefined}>
                <CardBody>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {minute.meeting_date} · {minute.department_name ?? departmentName(minute.department_id)}
                      </div>
                      <h2 className="mt-1 font-semibold text-slate-900">{minute.title}</h2>
                    </div>
                    {canView ? (
                      <span className="flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700"><Eye className="h-3.5 w-3.5" />閲覧可能</span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600"><LockKeyhole className="h-3.5 w-3.5" />本文非公開</span>
                    )}
                  </div>
                  {canView ? (
                    <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
                      <section><p className="font-medium text-slate-700">議題・課題</p><p className="mt-1 whitespace-pre-wrap text-slate-600">{minute.agenda}</p></section>
                      <section><p className="font-medium text-slate-700">決定事項</p><p className="mt-1 whitespace-pre-wrap text-slate-600">{minute.decisions}</p></section>
                      <section className="md:col-span-2"><p className="font-medium text-slate-700">担当・期限</p><p className="mt-1 whitespace-pre-wrap text-slate-600">{minute.action_items || '未登録'}</p></section>
                      <p className="text-xs text-slate-400 md:col-span-2">参加者: {minute.participants || '未登録'} · 記録者: {minute.created_by_name ?? minute.created_by}</p>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                      <p className="text-sm text-slate-500">他部署の本文を読むには管理者の承認が必要です。</p>
                      {accessRequest?.status === 'pending' && <span className="text-sm font-medium text-amber-700">申請中</span>}
                      {accessRequest?.status === 'rejected' && <Button size="sm" variant="secondary" onClick={() => setRequestingMinute(minute)}>理由を見直して再申請</Button>}
                      {!accessRequest && <Button size="sm" variant="secondary" onClick={() => setRequestingMinute(minute)}>閲覧を申請</Button>}
                    </div>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
