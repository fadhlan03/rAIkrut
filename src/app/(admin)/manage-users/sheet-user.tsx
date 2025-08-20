"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { User } from "@/types/database";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserPlus, Edit, Mail, User as UserIcon, Lock, Loader2, Eye, EyeOff, Settings, Info } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import React from 'react';

interface SheetUserProps {
  user: User | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  isEditMode: boolean;
  onUserUpdated: () => void;
}

interface UserFormData {
  full_name: string;
  email: string;
  type: 'admin' | 'applicant';
  password?: string;
}

export function SheetUser({ user, isOpen, onOpenChange, isEditMode, onUserUpdated }: SheetUserProps) {
  const [formData, setFormData] = React.useState<UserFormData>({
    full_name: '',
    email: '',
    type: 'applicant',
    password: '',
  });
  const [isLoading, setIsLoading] = React.useState(false);
  const [errors, setErrors] = React.useState<Partial<UserFormData>>({});
  const [showPassword, setShowPassword] = React.useState(false);

  // Reset form when user changes or sheet opens/closes
  React.useEffect(() => {
    if (isOpen) {
      if (isEditMode && user) {
        setFormData({
          full_name: user.full_name,
          email: user.email,
          type: user.type,
          password: '', // Never pre-populate password
        });
      } else {
        setFormData({
          full_name: '',
          email: '',
          type: 'applicant',
          password: '',
        });
      }
      setErrors({});
    }
  }, [isOpen, isEditMode, user]);

  const validateForm = (): boolean => {
    const newErrors: Partial<UserFormData> = {};

    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Full name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!isEditMode && !formData.password) {
      newErrors.password = 'Password is required for new users';
    }

    if (formData.password && formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof UserFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    
    try {
      const url = isEditMode && user ? `/api/users/${user.id}` : '/api/users';
      const method = isEditMode ? 'PUT' : 'POST';
      
      const payload: any = {
        full_name: formData.full_name.trim(),
        email: formData.email.trim(),
        type: formData.type,
      };

      // Only include password if it's provided
      if (formData.password) {
        payload.password = formData.password;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${isEditMode ? 'update' : 'create'} user`);
      }

      toast.success(`User ${isEditMode ? 'updated' : 'created'} successfully`);
      onUserUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save user');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent 
        className="p-0 flex flex-col max-w-full sm:max-w-md w-full h-svh" 
        side="right"
      >
        <SheetHeader className="p-6 pb-4 border-b shrink-0">
          <SheetTitle className="text-xl font-semibold tracking-tight pr-8 flex items-center">
            {isEditMode ? (
              <><Edit className="size-7 mr-2.5 text-primary" /> Edit User</>
            ) : (
              <><UserPlus className="size-7 mr-2.5 text-primary" /> Add New User</>
            )}
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-grow min-h-0">
          <ScrollArea className="flex-grow min-h-0">
            <div className="px-6 pt-4 pb-6 space-y-6">
              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="full_name" className="text-sm font-medium flex items-center">
                  <UserIcon className="size-4 text-primary" />
                  Full Name
                </Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => handleInputChange('full_name', e.target.value)}
                  placeholder="Enter full name"
                  className={errors.full_name ? 'border-destructive' : ''}
                />
                {errors.full_name && (
                  <p className="text-sm text-destructive">{errors.full_name}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium flex items-center">
                  <Mail className="size-4 text-primary" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="Enter email address"
                  className={errors.email ? 'border-destructive' : ''}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>

              {/* User Type */}
              <div className="space-y-2">
                <Label htmlFor="type" className="text-sm font-medium flex items-center">
                  <Settings className="size-4 text-primary" />
                  User Type
                </Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: 'admin' | 'applicant') => handleInputChange('type', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select user type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="applicant">Applicant</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium flex items-center">
                  <Lock className="size-4 text-primary" />
                  Password
                  {isEditMode && (
                    <span className="text-xs text-muted-foreground ml-2">(leave empty to keep current)</span>
                  )}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    placeholder={isEditMode ? "Enter new password (optional)" : "Enter password"}
                    className={`pr-10 ${errors.password ? 'border-destructive' : ''}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="size-4 text-muted-foreground" />
                    ) : (
                      <Eye className="size-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password}</p>
                )}
              </div>

              {isEditMode && user && (
                <div className="pt-4 border-t">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center">
                    <Info className="size-4 mr-2 text-primary" />
                    User Information
                  </h3>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex">
                      <span className="w-16">Created</span>
                      <span className="mr-2">:</span>
                      <span>{user.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</span>
                    </div>
                    <div className="flex">
                      <span className="w-16">User ID</span>
                      <span className="mr-2">:</span>
                      <span>{user.id}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <SheetFooter className="p-6 pt-4 border-t bg-background shrink-0 flex flex-row justify-between items-center">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {isEditMode ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                isEditMode ? 'Update User' : 'Create User'
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}