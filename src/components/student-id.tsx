'use client';
import { useHydratedReducedMotion } from '@/hooks/use-hydrated-reduced-motion';
import Image from 'next/image';
import Link from 'next/link';
import { ChangeEvent, useId, useState } from 'react';
import { ArrowUpRight, Camera, Check, GraduationCap, Mail, MapPin, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { Student } from '@/types';
import { studentService } from '@/services/platform.service';

async function preparePortrait(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw new Error('Choose a PNG, JPG, or WebP photo.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Choose a photo smaller than 8 MB.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 720 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('Unable to read this photo. Try another image.');
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/webp', 0.86);
}

export function CareerID({
  student,
  refresh,
  notify,
  showcase = false,
}: {
  student: Student;
  refresh?: () => void;
  notify?: (message: string) => void;
  showcase?: boolean;
}) {
  const id = useId();
  const reduced = useHydratedReducedMotion();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      await studentService.updatePhoto(await preparePortrait(file));
      refresh?.();
      notify?.('Your ID card photo has been updated.');
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Unable to save your photo. Free some browser storage and try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={`student-id-wrap ${showcase ? 'id-showcase' : ''}`}>
      <div className="id-lanyard" aria-hidden="true">
        <span>CAMPUSLINK / NEXT GEN</span>
      </div>
      <div className="id-metal-clip" aria-hidden="true" />
      <motion.article
        className="student-badge"
        aria-label={`${student.name} student ID card`}
        whileHover={reduced ? {} : { rotate: showcase ? -3 : -1, y: -3 }}
        transition={{ type: 'spring', stiffness: 160, damping: 17 }}
      >
        <div className="badge-slot" aria-hidden="true" />
        <div className="badge-side">
          <span>STUDENT / CLASS OF {student.year}</span>
          <b>01</b>
        </div>
        <div className="badge-main">
          <header>
            <span className="badge-brand">
              <GraduationCap size={23} /> campuslink
            </span>
            <span>CAREER ID</span>
          </header>
          <div className={`badge-portrait ${student.photo ? 'has-photo' : ''}`}>
            {student.photo ? (
              <Image
                src={student.photo}
                alt={`${student.name} portrait`}
                width={360}
                height={300}
                unoptimized
              />
            ) : (
              <div className="badge-initials">
                <span>
                  {student.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')}
                </span>
                <small>YOUR NEXT CHAPTER STARTS HERE</small>
              </div>
            )}
            <span className="badge-photo-grid" aria-hidden="true" />
          </div>
          <div className="badge-details">
            <h3>{student.name}</h3>
            <p>{student.course}</p>
            <span>
              <Mail size={11} />
              {student.email}
            </span>
            <span>
              <MapPin size={11} />
              {student.campus}
            </span>
          </div>
          <div className="badge-serial">
            <span>{student.id}</span>
            <span className="badge-barcode" aria-hidden="true" />
            <span>CLASS / {student.year}</span>
          </div>
          <div className="badge-status">
            <span>
              <Check size={12} />
              {student.skills.filter((s) => s.verified).length} verified skills
            </span>
            <span>{student.xp.toLocaleString()} XP</span>
          </div>
        </div>
      </motion.article>
      {refresh && (
        <div className="badge-controls">
          <label htmlFor={id} className={`badge-upload ${busy ? 'is-busy' : ''}`}>
            <Camera size={14} />
            {busy ? 'Adding photo…' : student.photo ? 'Change photo' : 'Add your PNG photo'}
            <input
              id={id}
              aria-label="Upload student ID photo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={upload}
            />
          </label>
          {student.photo && (
            <button
              disabled={busy}
              aria-label="Remove ID photo"
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  await studentService.updatePhoto();
                  refresh();
                } catch {
                  setError('Unable to remove photo. Try again.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <X size={14} />
            </button>
          )}
          <Link href="/student/profile" aria-label="View student profile">
            <ArrowUpRight size={16} />
          </Link>
        </div>
      )}
      {error && (
        <p role="alert" className="badge-error">
          {error}
        </p>
      )}
      {refresh && <p className="badge-auto-note">Your profile updates this card automatically.</p>}
    </div>
  );
}
