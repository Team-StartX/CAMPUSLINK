'use client';
import { useState } from 'react';
import type { InterviewSlot } from '@/types/recruitment';
import { FormField } from './ui';

export function InterviewScheduleFields({
  schedule,
  duration,
  canOverride,
}: {
  schedule?: InterviewSlot;
  duration: number;
  canOverride: boolean;
}) {
  const [mode, setMode] = useState(schedule?.mode || 'Offline');
  const [override, setOverride] = useState(false);
  return (
    <>
      <div className="form-row">
        <FormField label="Interview date">
          <input name="date" type="date" required defaultValue={schedule?.date} />
        </FormField>
        <FormField label="Start time (IST)">
          <input name="time" type="time" required defaultValue={schedule?.time} />
        </FormField>
      </div>
      <div className="form-row">
        <FormField label="Duration (minutes)">
          <input
            name="duration"
            type="number"
            min={5}
            max={480}
            step={1}
            required
            defaultValue={schedule?.duration ?? duration}
          />
        </FormField>
        <FormField label="Interview format">
          <select name="mode" value={mode} onChange={(event) => setMode(event.target.value)}>
            <option>Offline</option>
            <option>Online</option>
          </select>
        </FormField>
      </div>
      <FormField label="Interview panel">
        <input
          name="panel"
          required
          defaultValue={schedule?.panel}
          placeholder="Panel name or interviewer"
        />
      </FormField>
      {mode === 'Online' ? (
        <>
          <FormField label="Meeting link (HTTPS)">
            <input
              name="meetingLink"
              type="url"
              required
              pattern="https://.*"
              placeholder="https://meet.google.com/…"
              defaultValue={schedule?.meetingLink}
            />
          </FormField>
          <input type="hidden" name="venue" value="" />
          <input type="hidden" name="room" value="" />
        </>
      ) : (
        <>
          <div className="form-row">
            <FormField label="Venue">
              <input
                name="venue"
                required
                defaultValue={schedule?.venue}
                placeholder="Building or venue"
              />
            </FormField>
            <FormField label="Room (optional)">
              <input name="room" defaultValue={schedule?.room} placeholder="Room number" />
            </FormField>
          </div>
          <input type="hidden" name="meetingLink" value="" />
        </>
      )}
      {canOverride && (
        <>
          <label className="checkbox-label">
            <input
              name="override"
              type="checkbox"
              checked={override}
              onChange={(event) => setOverride(event.target.checked)}
            />
            Override a scheduling conflict
          </label>
          {override && (
            <FormField label="Reason for override">
              <input
                name="reason"
                required
                minLength={5}
                placeholder="Explain why this conflict is acceptable"
              />
            </FormField>
          )}
        </>
      )}
    </>
  );
}
