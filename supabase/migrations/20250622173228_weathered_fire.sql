/*
  # Create submissions table

  1. New Tables
    - `submissions`
      - `id` (uuid, primary key)
      - `assignment_id` (uuid, foreign key to assignments)
      - `user_id` (uuid, foreign key to profiles)
      - `submitted_at` (timestamptz, when submission was made)
      - `file_url` (text, optional, for file uploads)
      - `answer_text` (text, optional, for text responses)
      - `score` (integer, 0-100, nullable until graded)
      - `feedback` (text, optional, teacher feedback)
      - `status` (text, check constraint: 'pending', 'submitted', 'late', 'graded', 'returned')
      - `graded_by` (uuid, foreign key to profiles, nullable)
      - `graded_at` (timestamptz, when grading was completed)
      - `created_at` (timestamptz, default now)
      - `updated_at` (timestamptz, default now)

  2. Security
    - Enable RLS on `submissions` table
    - Add policies for students to manage their own submissions
    - Add policies for teachers to view and grade submissions for their courses

  3. Indexes
    - Index on assignment_id for efficient assignment-based queries
    - Index on user_id for user-based queries
    - Index on status for filtering by submission status
    - Unique constraint on (assignment_id, user_id) to prevent duplicate submissions
*/

CREATE TABLE IF NOT EXISTS submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  submitted_at timestamptz,
  file_url text,
  answer_text text,
  score integer,
  feedback text,
  status text NOT NULL DEFAULT 'pending',
  graded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  graded_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT submissions_status_check CHECK (status IN ('pending', 'submitted', 'late', 'graded', 'returned')),
  CONSTRAINT submissions_score_check CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  CONSTRAINT submissions_unique_user_assignment UNIQUE (assignment_id, user_id)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_graded_by ON submissions(graded_by);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON submissions(submitted_at);

-- Add updated_at trigger
CREATE TRIGGER update_submissions_updated_at
  BEFORE UPDATE ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Policy: Students can view their own submissions
CREATE POLICY "Students can view their own submissions"
  ON submissions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Teachers can view submissions for assignments in their courses
CREATE POLICY "Teachers can view submissions for their course assignments"
  ON submissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assignments a
      JOIN courses c ON c.id = a.course_id
      WHERE a.id = submissions.assignment_id
      AND c.instructor_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Students can create their own submissions
CREATE POLICY "Students can create their own submissions"
  ON submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM assignments a
      JOIN enrollments e ON e.course_id = a.course_id
      WHERE a.id = submissions.assignment_id
      AND e.user_id = auth.uid()
      AND e.status = 'active'
      AND a.status = 'published'
    )
  );

-- Policy: Students can update their own submissions (before grading)
CREATE POLICY "Students can update their own submissions"
  ON submissions
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() AND
    status IN ('pending', 'submitted', 'late')
  )
  WITH CHECK (
    user_id = auth.uid() AND
    status IN ('pending', 'submitted', 'late')
  );

-- Policy: Teachers can update submissions for assignments in their courses
CREATE POLICY "Teachers can update submissions for their course assignments"
  ON submissions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assignments a
      JOIN courses c ON c.id = a.course_id
      WHERE a.id = submissions.assignment_id
      AND c.instructor_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM assignments a
      JOIN courses c ON c.id = a.course_id
      WHERE a.id = submissions.assignment_id
      AND c.instructor_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Teachers can delete submissions for assignments in their courses
CREATE POLICY "Teachers can delete submissions for their course assignments"
  ON submissions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assignments a
      JOIN courses c ON c.id = a.course_id
      WHERE a.id = submissions.assignment_id
      AND c.instructor_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );