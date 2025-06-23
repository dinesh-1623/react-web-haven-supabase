/*
  # Create assignments table

  1. New Tables
    - `assignments`
      - `id` (uuid, primary key)
      - `course_id` (uuid, foreign key to courses)
      - `quiz_id` (uuid, foreign key to quizzes, nullable for non-quiz assignments)
      - `title` (text, required)
      - `description` (text, optional)
      - `type` (text, check constraint: 'quiz', 'assignment', 'exam')
      - `due_date` (timestamptz, required)
      - `max_score` (integer, positive values only)
      - `instructions` (text, optional)
      - `status` (text, check constraint: 'draft', 'published', 'archived')
      - `created_at` (timestamptz, default now)
      - `updated_at` (timestamptz, default now)

  2. Security
    - Enable RLS on `assignments` table
    - Add policies for teachers/admins to manage assignments
    - Add policies for students to view published assignments in enrolled courses

  3. Indexes
    - Index on course_id for efficient course-based queries
    - Index on quiz_id for quiz-assignment relationships
    - Index on due_date for sorting by due dates
    - Index on status for filtering by assignment status
*/

CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  quiz_id uuid REFERENCES quizzes(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'assignment',
  due_date timestamptz NOT NULL,
  max_score integer NOT NULL DEFAULT 100,
  instructions text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT assignments_type_check CHECK (type IN ('quiz', 'assignment', 'exam')),
  CONSTRAINT assignments_status_check CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT assignments_max_score_check CHECK (max_score > 0)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_assignments_course_id ON assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_assignments_quiz_id ON assignments(quiz_id);
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON assignments(due_date);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_type ON assignments(type);

-- Add updated_at trigger
CREATE TRIGGER update_assignments_updated_at
  BEFORE UPDATE ON assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

-- Policy: Students can view published assignments for courses they are enrolled in
CREATE POLICY "Students can view published assignments for enrolled courses"
  ON assignments
  FOR SELECT
  TO authenticated
  USING (
    status = 'published' AND (
      EXISTS (
        SELECT 1 FROM enrollments
        WHERE enrollments.course_id = assignments.course_id
        AND enrollments.user_id = auth.uid()
        AND enrollments.status = 'active'
      )
    )
  );

-- Policy: Teachers can view all assignments for their courses
CREATE POLICY "Teachers can view assignments for their courses"
  ON assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = assignments.course_id
      AND courses.instructor_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Teachers can create assignments for their courses
CREATE POLICY "Teachers can create assignments for their courses"
  ON assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = assignments.course_id
      AND courses.instructor_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Teachers can update assignments for their courses
CREATE POLICY "Teachers can update assignments for their courses"
  ON assignments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = assignments.course_id
      AND courses.instructor_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = assignments.course_id
      AND courses.instructor_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Teachers can delete assignments for their courses
CREATE POLICY "Teachers can delete assignments for their courses"
  ON assignments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = assignments.course_id
      AND courses.instructor_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );