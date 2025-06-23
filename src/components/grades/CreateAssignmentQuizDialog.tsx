import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Upload, FileText, X, Save, Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface Course {
  id: string;
  title: string;
  code?: string;
}

interface CreateAssignmentQuizDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: Course[];
  onAssignmentCreated: (assignmentId: string) => void;
}

interface FormData {
  title: string;
  description: string;
  type: 'quiz' | 'assignment' | 'exam';
  courseId: string;
  dueDate: Date;
  maxScore: number;
  instructions: string;
}

const CreateAssignmentQuizDialog: React.FC<CreateAssignmentQuizDialogProps> = ({
  open,
  onOpenChange,
  courses,
  onAssignmentCreated
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const { user } = useAuth();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors }
  } = useForm<FormData>({
    defaultValues: {
      title: '',
      description: '',
      type: 'assignment',
      courseId: '',
      dueDate: new Date(),
      maxScore: 100,
      instructions: ''
    }
  });

  const watchedType = watch('type');
  const watchedDueDate = watch('dueDate');

  const handleClose = () => {
    reset();
    setUploadedFile(null);
    onOpenChange(false);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf' || 
          file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
          file.type === 'text/plain') {
        setUploadedFile(file);
        toast.success('File uploaded successfully');
      } else {
        toast.error('Please upload a PDF, DOCX, or TXT file');
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadedFile(file);
      toast.success('File uploaded successfully');
    }
  };

  const onSubmit = async (data: FormData) => {
    console.log('🔍 CreateAssignmentQuizDialog: Starting form submission');
    console.log('🔍 CreateAssignmentQuizDialog: Form data:', data);
    console.log('🔍 CreateAssignmentQuizDialog: Current user:', user);

    if (!user) {
      console.error('❌ CreateAssignmentQuizDialog: No user found');
      toast.error('You must be logged in to create assignments');
      return;
    }

    setSubmitting(true);
    
    try {
      console.log('🔍 CreateAssignmentQuizDialog: Preparing assignment data for database');
      
      const assignmentData = {
        title: data.title,
        description: data.description,
        type: data.type,
        course_id: data.courseId,
        due_date: data.dueDate.toISOString(),
        max_score: data.maxScore,
        instructions: data.instructions,
        status: 'draft' // Start as draft
      };

      console.log('🔍 CreateAssignmentQuizDialog: Assignment data to insert:', assignmentData);

      // Insert the assignment into the database
      console.log('🔍 CreateAssignmentQuizDialog: Executing Supabase insert...');
      const { data: assignment, error } = await supabase
        .from('assignments')
        .insert(assignmentData)
        .select()
        .single();

      if (error) {
        console.error('❌ CreateAssignmentQuizDialog: Supabase error:', error);
        console.error('❌ CreateAssignmentQuizDialog: Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        toast.error('Failed to create assignment. Please try again.');
        return;
      }

      console.log('✅ CreateAssignmentQuizDialog: Assignment created successfully:', assignment);
      console.log('🔍 CreateAssignmentQuizDialog: Assignment ID:', assignment.id);

      toast.success(`${data.type.charAt(0).toUpperCase() + data.type.slice(1)} created successfully!`);
      onAssignmentCreated(assignment.id);
      handleClose();
    } catch (error) {
      console.error('❌ CreateAssignmentQuizDialog: Exception during submission:', error);
      toast.error('Failed to create assignment. Please try again.');
    } finally {
      setSubmitting(false);
      console.log('🔍 CreateAssignmentQuizDialog: Form submission completed');
    }
  };

  const getTypeDescription = (type: string) => {
    switch (type) {
      case 'quiz':
        return 'Interactive quiz with multiple choice, true/false, and short answer questions';
      case 'assignment':
        return 'Project or homework assignment with file submission capability';
      case 'exam':
        return 'Formal examination with time limits and proctoring options';
      default:
        return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create New Assignment
          </DialogTitle>
          <DialogDescription>
            Create a new quiz, assignment, or exam for your students
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    placeholder="Enter assignment title..."
                    {...register('title', { 
                      required: 'Title is required',
                      minLength: { value: 5, message: 'Title must be at least 5 characters' }
                    })}
                  />
                  {errors.title && (
                    <p className="text-sm text-destructive">{errors.title.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Type *</Label>
                  <Select 
                    value={watchedType} 
                    onValueChange={(value) => setValue('type', value as any)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="assignment">Assignment</SelectItem>
                      <SelectItem value="quiz">Quiz</SelectItem>
                      <SelectItem value="exam">Exam</SelectItem>
                    </SelectContent>
                  </Select>
                  {watchedType && (
                    <p className="text-xs text-muted-foreground">
                      {getTypeDescription(watchedType)}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="course">Course *</Label>
                  <Select 
                    value={watch('courseId')} 
                    onValueChange={(value) => setValue('courseId', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select course" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.length === 0 ? (
                        <SelectItem value="no-courses-available" disabled>No courses available</SelectItem>
                      ) : (
                        courses.map(course => (
                          <SelectItem key={course.id} value={course.id}>
                            {course.code} - {course.title}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {errors.courseId && (
                    <p className="text-sm text-destructive">Course is required</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Due Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !watchedDueDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {watchedDueDate ? format(watchedDueDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={watchedDueDate}
                        onSelect={(date) => date && setValue('dueDate', date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Provide a detailed description of the assignment..."
                  rows={3}
                  {...register('description')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Quiz Document Upload (Phase 1) */}
          {watchedType === 'quiz' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Quiz Source Document
                </CardTitle>
                <CardDescription>
                  Upload a document to use as reference for creating quiz questions (Phase 1)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragActive 
                      ? 'border-primary bg-primary/5' 
                      : 'border-muted-foreground/25 hover:border-primary/50'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  {uploadedFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="h-8 w-8 text-primary" />
                      <div className="text-left">
                        <p className="font-medium text-foreground">{uploadedFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setUploadedFile(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-lg font-medium text-foreground mb-2">
                        Drop your quiz document here
                      </p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Supports PDF, DOCX, and TXT files
                      </p>
                      <input
                        type="file"
                        accept=".pdf,.docx,.txt"
                        onChange={handleFileInput}
                        className="hidden"
                        id="file-upload"
                      />
                      <Button type="button" variant="outline" asChild>
                        <label htmlFor="file-upload" className="cursor-pointer">
                          Choose File
                        </label>
                      </Button>
                    </div>
                  )}
                </div>
                
                {uploadedFile && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <div className="p-1 bg-blue-100 rounded">
                        <FileText className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900">
                          Document uploaded successfully!
                        </p>
                        <p className="text-xs text-blue-700 mt-1">
                          After creating this quiz, you'll be able to manually add questions 
                          based on the uploaded document. Future versions will support 
                          automatic question extraction.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Assignment Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Assignment Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxScore">Maximum Score</Label>
                  <Input
                    id="maxScore"
                    type="number"
                    min="1"
                    max="1000"
                    {...register('maxScore', { 
                      required: 'Maximum score is required',
                      min: { value: 1, message: 'Score must be at least 1' },
                      max: { value: 1000, message: 'Score cannot exceed 1000' },
                      valueAsNumber: true
                    })}
                  />
                  {errors.maxScore && (
                    <p className="text-sm text-destructive">{errors.maxScore.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="flex items-center gap-2 pt-2">
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                      Draft
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Assignment will be saved as draft
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructions">Instructions for Students</Label>
                <Textarea
                  id="instructions"
                  placeholder="Provide detailed instructions for completing this assignment..."
                  rows={4}
                  {...register('instructions')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={handleClose}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={submitting}
              className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            >
              <Save className="h-4 w-4 mr-2" />
              {submitting ? 'Creating...' : `Create ${watchedType || 'Assignment'}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateAssignmentQuizDialog;