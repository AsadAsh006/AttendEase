import React, { useState, useEffect, useCallback } from 'react'
import {
  StyleSheet,
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Share,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { moderateScale } from 'react-native-size-matters'
import { useFocusEffect } from '@react-navigation/native'
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'
import CustomText from '../../components/text'
import { useAuth } from '../../contexts/AuthContext'
import { useOffline } from '../../contexts/OfflineContext'
import { MMKV } from 'react-native-mmkv'
import { supabase } from '../../lib/supabase'

const storage = new MMKV()
const NOTEPAD_CACHE_KEY = 'AttendEase.studentNotepad'

interface Note {
  id: string
  subjectId: string
  subjectName: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
  color: string
  isShared: boolean
  createdBy?: string
  createdByName?: string
  isOwnNote?: boolean // Client-side flag to identify user's own notes
}

interface Subject {
  id: string
  name: string
  color?: string
}

const NOTE_COLORS = [
  '#FEF3C7', // Yellow
  '#DBEAFE', // Blue
  '#D1FAE5', // Green
  '#FCE7F3', // Pink
  '#E9D5FF', // Purple
  '#FED7AA', // Orange
  '#E5E7EB', // Gray
]

const StudentNotepad = () => {
  const { userProfile, handleAuthError } = useAuth()
  const { isOnline } = useOffline()
  const [notes, setNotes] = useState<Note[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [selectedColor, setSelectedColor] = useState(NOTE_COLORS[0])
  const [selectedSubjectForNote, setSelectedSubjectForNote] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isShared, setIsShared] = useState(false)
  const [showSharedOnly, setShowSharedOnly] = useState(false)
  const [loading, setLoading] = useState(false)
  const [previewNote, setPreviewNote] = useState<Note | null>(null)
  const [previewModalVisible, setPreviewModalVisible] = useState(false)

  useEffect(() => {
    loadCachedNotes()
    if (isOnline) {
      fetchSubjects()
      fetchNotesFromDatabase()
    }
  }, [isOnline])

  // Refetch when active class changes
  useEffect(() => {
    if (isOnline && (userProfile?.active_class_id || userProfile?.class_id)) {
      fetchSubjects()
      fetchNotesFromDatabase()
    }
  }, [userProfile?.active_class_id, userProfile?.class_id, isOnline])

  const loadCachedNotes = () => {
    try {
      const cached = storage.getString(NOTEPAD_CACHE_KEY)
      if (cached) {
        const data = JSON.parse(cached)
        setNotes(data.notes || [])
        setSubjects(data.subjects || [])
      }
    } catch (error) {
      console.error('Error loading cached notes:', error)
    }
  }

  const saveNotesToCache = (notesData: Note[], subjectsData: Subject[]) => {
    try {
      storage.set(NOTEPAD_CACHE_KEY, JSON.stringify({ notes: notesData, subjects: subjectsData }))
    } catch (error) {
      console.error('Error caching notes:', error)
    }
  }

  // Refetch data when screen comes into focus (e.g., after leaving a class)
  useFocusEffect(
    useCallback(() => {
      const activeClassId = userProfile?.active_class_id || userProfile?.class_id
      if (isOnline && activeClassId) {
        fetchSubjects()
      }
    }, [isOnline, userProfile?.active_class_id, userProfile?.class_id, fetchSubjects])
  )

  const fetchNotesFromDatabase = async () => {
    const activeClassId = userProfile?.active_class_id || userProfile?.class_id
    if (!activeClassId || !userProfile?.id) return

    try {
      setLoading(true)
      
      // Fetch user's own notes and shared notes from the class
      const { data, error } = await supabase
        .from('notes')
        .select(`
          id,
          subject_id,
          title,
          content,
          color,
          is_shared,
          created_by,
          created_by_name,
          created_at,
          updated_at,
          subjects!inner(name)
        `)
        .eq('class_id', activeClassId)
        .or(`created_by.eq.${userProfile.id},is_shared.eq.true`)
        .order('updated_at', { ascending: false })

      if (error) {
        handleAuthError(error)
        return
      }

      if (data) {
        const mappedNotes: Note[] = data.map((note: any) => ({
          id: note.id,
          subjectId: note.subject_id,
          subjectName: note.subjects?.name || 'Unknown',
          title: note.title,
          content: note.content,
          color: note.color,
          isShared: note.is_shared,
          createdBy: note.created_by,
          createdByName: note.created_by_name,
          createdAt: new Date(note.created_at).getTime(),
          updatedAt: new Date(note.updated_at).getTime(),
          isOwnNote: note.created_by === userProfile.id,
        }))

        setNotes(mappedNotes)
        saveNotesToCache(mappedNotes, subjects)
      }
    } catch (error) {
      console.error('Error fetching notes:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSubjects = useCallback(async () => {
    const activeClassId = userProfile?.active_class_id || userProfile?.class_id
    if (!activeClassId) return

    try {
      // First get student ID
      const { data: studentData } = await supabase
        .from('students')
        .select('id')
        .eq('class_id', activeClassId)
        .or(`email.eq.${userProfile.email},roll_number.eq.${userProfile.roll_number}`)
        .single()

      if (!studentData) {
        setSubjects([])
        return
      }

      // Fetch only enrolled subjects
      const { data: enrolledSubjects, error: enrollmentError } = await supabase
        .from('student_subjects')
        .select('subject_id')
        .eq('student_id', studentData.id)

      if (enrollmentError) {
        handleAuthError(enrollmentError)
        return
      }

      const enrolledSubjectIds = enrolledSubjects?.map(es => es.subject_id) || []

      if (enrolledSubjectIds.length === 0) {
        setSubjects([])
        saveNotesToCache(notes, [])
        return
      }

      const { data, error } = await supabase
        .from('subjects')
        .select('id, name, color')
        .in('id', enrolledSubjectIds)
        .order('name')

      if (error) {
        handleAuthError(error)
        return
      }

      setSubjects(data || [])
      saveNotesToCache(notes, data || [])
    } catch (error) {
      console.error('Error fetching subjects:', error)
    }
  }, [userProfile?.class_id, userProfile?.email, userProfile?.roll_number, notes])

  const handleSaveNote = async () => {
    if (!noteTitle.trim() || !selectedSubjectForNote) {
      Alert.alert('Error', 'Please enter a title and select a subject')
      return
    }

    const subjectInfo = subjects.find(s => s.id === selectedSubjectForNote)
    const activeClassId = userProfile?.active_class_id || userProfile?.class_id

    if (!activeClassId) {
      Alert.alert('Error', 'No active class found')
      return
    }

    try {
      setLoading(true)

      if (editingNote) {
        // Only allow editing own notes
        if (editingNote.createdBy && editingNote.createdBy !== userProfile?.id) {
          Alert.alert('Error', 'You can only edit your own notes')
          return
        }

        // Update existing note
        if (isOnline) {
          const { error } = await supabase
            .from('notes')
            .update({
              title: noteTitle.trim(),
              content: noteContent.trim(),
              subject_id: selectedSubjectForNote,
              color: selectedColor,
              is_shared: isShared,
              updated_at: new Date().toISOString(),
            })
            .eq('id', editingNote.id)

          if (error) {
            handleAuthError(error)
            return
          }
        }

        const updatedNotes = notes.map(note =>
          note.id === editingNote.id
            ? {
                ...note,
                title: noteTitle.trim(),
                content: noteContent.trim(),
                subjectId: selectedSubjectForNote,
                subjectName: subjectInfo?.name || '',
                color: selectedColor,
                isShared: isShared,
                updatedAt: Date.now(),
              }
            : note
        )
        setNotes(updatedNotes)
        saveNotesToCache(updatedNotes, subjects)
      } else {
        // Create new note
        if (isOnline) {
          const { data, error } = await supabase
            .from('notes')
            .insert({
              subject_id: selectedSubjectForNote,
              class_id: activeClassId,
              created_by: userProfile?.id,
              created_by_name: userProfile?.name || 'Unknown',
              title: noteTitle.trim(),
              content: noteContent.trim(),
              color: selectedColor,
              is_shared: isShared,
            })
            .select()
            .single()

          if (error) {
            handleAuthError(error)
            return
          }

          if (data) {
            const newNote: Note = {
              id: data.id,
              subjectId: selectedSubjectForNote,
              subjectName: subjectInfo?.name || '',
              title: noteTitle.trim(),
              content: noteContent.trim(),
              color: selectedColor,
              isShared: isShared,
              createdBy: userProfile?.id,
              createdByName: userProfile?.name || 'Unknown',
              createdAt: new Date(data.created_at).getTime(),
              updatedAt: new Date(data.updated_at).getTime(),
              isOwnNote: true,
            }
            const updatedNotes = [newNote, ...notes]
            setNotes(updatedNotes)
            saveNotesToCache(updatedNotes, subjects)
          }
        } else {
          // Offline mode - create temporary note
          const newNote: Note = {
            id: `note_${Date.now()}`,
            subjectId: selectedSubjectForNote,
            subjectName: subjectInfo?.name || '',
            title: noteTitle.trim(),
            content: noteContent.trim(),
            color: selectedColor,
            isShared: isShared,
            createdBy: userProfile?.id,
            createdByName: userProfile?.name || 'Unknown',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            isOwnNote: true,
          }
          const updatedNotes = [newNote, ...notes]
          setNotes(updatedNotes)
          saveNotesToCache(updatedNotes, subjects)
        }
      }

      resetModal()
    } catch (error) {
      console.error('Error saving note:', error)
      Alert.alert('Error', 'Failed to save note')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteNote = (note: Note) => {
    // Only allow deleting own notes
    if (note.createdBy && note.createdBy !== userProfile?.id) {
      Alert.alert('Error', 'You can only delete your own notes')
      return
    }

    Alert.alert('Delete Note', 'Are you sure you want to delete this note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            if (isOnline) {
              const { error } = await supabase
                .from('notes')
                .delete()
                .eq('id', note.id)

              if (error) {
                handleAuthError(error)
                return
              }
            }

            const updatedNotes = notes.filter(n => n.id !== note.id)
            setNotes(updatedNotes)
            saveNotesToCache(updatedNotes, subjects)
          } catch (error) {
            console.error('Error deleting note:', error)
            Alert.alert('Error', 'Failed to delete note')
          }
        },
      },
    ])
  }

  const handleShareNote = async (note: Note) => {
    try {
      await Share.share({
        message: `📚 ${note.subjectName}\n\n📝 ${note.title}\n\n${note.content}\n\n---\nShared from AttendEase`,
        title: note.title,
      })
    } catch (error) {
      console.error('Error sharing note:', error)
    }
  }

  const openPreviewModal = (note: Note) => {
    setPreviewNote(note)
    setPreviewModalVisible(true)
  }

  const openEditModal = (note?: Note) => {
    if (note) {
      setEditingNote(note)
      setNoteTitle(note.title)
      setNoteContent(note.content)
      setSelectedSubjectForNote(note.subjectId)
      setSelectedColor(note.color)
      setIsShared(note.isShared || false)
    } else {
      setEditingNote(null)
      setNoteTitle('')
      setNoteContent('')
      setSelectedSubjectForNote(subjects[0]?.id || '')
      setSelectedColor(NOTE_COLORS[0])
      setIsShared(false)
    }
    setModalVisible(true)
  }

  const closePreviewModal = () => {
    setPreviewModalVisible(false)
    setPreviewNote(null)
  }

  const resetModal = () => {
    setModalVisible(false)
    setEditingNote(null)
    setNoteTitle('')
    setNoteContent('')
    setSelectedSubjectForNote('')
    setSelectedColor(NOTE_COLORS[0])
    setIsShared(false)
  }

  const getFilteredNotes = () => {
    let filtered = notes

    // Filter by shared/my notes
    if (showSharedOnly) {
      filtered = filtered.filter(note => note.isShared && !note.isOwnNote)
    }

    if (selectedSubject) {
      filtered = filtered.filter(note => note.subjectId === selectedSubject)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        note =>
          note.title.toLowerCase().includes(query) ||
          note.content.toLowerCase().includes(query) ||
          note.subjectName.toLowerCase().includes(query) ||
          (note.createdByName && note.createdByName.toLowerCase().includes(query))
      )
    }

    return filtered.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  const renderNoteCard = ({ item }: { item: Note }) => (
    <TouchableOpacity
      style={[styles.noteCard, { backgroundColor: item.color }]}
      onPress={() => openPreviewModal(item)}
      onLongPress={() => handleDeleteNote(item)}
      activeOpacity={0.7}
    >
      <View style={styles.noteHeader}>
        <View style={styles.headerBadges}>
          <View style={styles.subjectBadge}>
            <CustomText text={item.subjectName} textStyle={styles.subjectBadgeText} />
          </View>
          {item.isShared && (
            <View style={styles.sharedBadge}>
              <Icon name="account-group" size={moderateScale(10)} color="#059669" />
              <CustomText text="Shared" textStyle={styles.sharedBadgeText} />
            </View>
          )}
        </View>
        <TouchableOpacity 
          onPress={(e) => {
            e.stopPropagation()
            handleShareNote(item)
          }} 
          style={styles.shareButton}
        >
          <Icon name="share-variant" size={moderateScale(16)} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <Text 
        style={styles.noteTitle}
        numberOfLines={2}
        ellipsizeMode="tail"
      >
        {item.title}
      </Text>
      <Text 
        style={styles.noteContent}
        numberOfLines={3}
        ellipsizeMode="tail"
      >
        {item.content}
      </Text>

      <View style={styles.noteFooter}>
        {!item.isOwnNote && item.createdByName && (
          <CustomText text={`By ${item.createdByName}`} textStyle={styles.noteAuthor} />
        )}
        <CustomText text={formatDate(item.updatedAt)} textStyle={styles.noteDate} />
      </View>
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerTitleRow}>
            <Icon name="notebook" size={moderateScale(24)} color="#0077B6" />
            <CustomText text=" My Notes" textStyle={styles.headerTitle} />
          </View>
          <TouchableOpacity onPress={() => openEditModal()} style={styles.addButton}>
            <Icon name="plus" size={moderateScale(20)} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Icon name="magnify" size={moderateScale(18)} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search notes..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* View Mode Toggle */}
        <View style={styles.viewModeContainer}>
          <TouchableOpacity
            style={[styles.viewModeButton, !showSharedOnly && styles.viewModeButtonActive]}
            onPress={() => setShowSharedOnly(false)}
          >
            <Icon 
              name="notebook" 
              size={moderateScale(16)} 
              color={!showSharedOnly ? '#FFFFFF' : '#6B7280'} 
            />
            <CustomText 
              text="My Notes" 
              textStyle={[styles.viewModeText, !showSharedOnly && styles.viewModeTextActive]} 
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewModeButton, showSharedOnly && styles.viewModeButtonActive]}
            onPress={() => setShowSharedOnly(true)}
          >
            <Icon 
              name="account-group" 
              size={moderateScale(16)} 
              color={showSharedOnly ? '#FFFFFF' : '#6B7280'} 
            />
            <CustomText 
              text="Class Notes" 
              textStyle={[styles.viewModeText, showSharedOnly && styles.viewModeTextActive]} 
            />
          </TouchableOpacity>
        </View>

        {/* Subject Filter */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
        >
          <TouchableOpacity
            style={[styles.filterChip, !selectedSubject && styles.filterChipActive]}
            onPress={() => setSelectedSubject(null)}
          >
            <CustomText 
              text="All" 
              textStyle={[styles.filterChipText, !selectedSubject && styles.filterChipTextActive]} 
            />
          </TouchableOpacity>
          {subjects.map((subject) => (
            <TouchableOpacity
              key={subject.id}
              style={[styles.filterChip, selectedSubject === subject.id && styles.filterChipActive]}
              onPress={() => setSelectedSubject(subject.id)}
            >
              <CustomText 
                text={subject.name} 
                textStyle={[styles.filterChipText, selectedSubject === subject.id && styles.filterChipTextActive]} 
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Notes Grid */}
      <FlatList
        data={getFilteredNotes()}
        renderItem={renderNoteCard}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.notesGrid}
        columnWrapperStyle={styles.noteRow}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="note-text-outline" size={moderateScale(48)} color="#9CA3AF" />
            <CustomText text="No notes yet" textStyle={styles.emptyTitle} />
            <CustomText text="Tap + to create your first note" textStyle={styles.emptySubtitle} />
          </View>
        }
      />

      {/* Note Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={resetModal}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <SafeAreaView style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={resetModal}>
                <CustomText text="Cancel" textStyle={styles.modalCancel} />
              </TouchableOpacity>
              <CustomText text={editingNote ? 'Edit Note' : 'New Note'} textStyle={styles.modalTitle} />
              <TouchableOpacity onPress={handleSaveNote}>
                <CustomText text="Save" textStyle={styles.modalSave} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Subject Selection */}
              <CustomText text="Subject" textStyle={styles.inputLabel} />
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.subjectScroll}
              >
                {subjects.map((subject) => (
                  <TouchableOpacity
                    key={subject.id}
                    style={[
                      styles.subjectOption,
                      selectedSubjectForNote === subject.id && styles.subjectOptionActive,
                    ]}
                    onPress={() => setSelectedSubjectForNote(subject.id)}
                  >
                    <CustomText 
                      text={subject.name} 
                      textStyle={[
                        styles.subjectOptionText,
                        selectedSubjectForNote === subject.id && styles.subjectOptionTextActive,
                      ]} 
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Color Selection */}
              <CustomText text="Color" textStyle={styles.inputLabel} />
              <View style={styles.colorRow}>
                {NOTE_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      selectedColor === color && styles.colorOptionActive,
                    ]}
                    onPress={() => setSelectedColor(color)}
                  >
                    {selectedColor === color && (
                      <CustomText text="✓" textStyle={styles.colorCheck} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Share Toggle */}
              <View style={styles.shareToggleContainer}>
                <View>
                  <CustomText text="Share with Class" textStyle={styles.inputLabel} />
                  <CustomText 
                    text="Allow your classmates to view this note" 
                    textStyle={styles.shareHintText} 
                  />
                </View>
                <TouchableOpacity
                  style={[styles.toggleButton, isShared && styles.toggleButtonActive]}
                  onPress={() => setIsShared(!isShared)}
                >
                  <View style={[styles.toggleThumb, isShared && styles.toggleThumbActive]}>
                    <Icon 
                      name={isShared ? 'check' : 'close'} 
                      size={moderateScale(14)} 
                      color={isShared ? '#059669' : '#9CA3AF'} 
                    />
                  </View>
                </TouchableOpacity>
              </View>

              {/* Title Input */}
              <CustomText text="Title" textStyle={styles.inputLabel} />
              <TextInput
                style={styles.titleInput}
                placeholder="Enter note title..."
                placeholderTextColor="#9CA3AF"
                value={noteTitle}
                onChangeText={setNoteTitle}
              />

              {/* Content Input */}
              <CustomText text="Content" textStyle={styles.inputLabel} />
              <TextInput
                style={styles.contentInput}
                placeholder="Write your notes here..."
                placeholderTextColor="#9CA3AF"
                value={noteContent}
                onChangeText={setNoteContent}
                multiline
                textAlignVertical="top"
              />
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Preview Modal */}
      <Modal
        visible={previewModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closePreviewModal}
      >
        <SafeAreaView style={styles.previewModalContainer}>
          {/* Preview Header */}
          <View style={styles.previewHeader}>
            <TouchableOpacity onPress={closePreviewModal}>
              <Icon name="close" size={moderateScale(24)} color="#6B7280" />
            </TouchableOpacity>
            <View style={styles.previewHeaderActions}>
              <TouchableOpacity onPress={() => previewNote && handleShareNote(previewNote)} style={styles.previewActionButton}>
                <Icon name="share-variant" size={moderateScale(20)} color="#0077B6" />
              </TouchableOpacity>
              {previewNote?.isOwnNote && (
                <TouchableOpacity 
                  onPress={() => {
                    closePreviewModal()
                    setTimeout(() => openEditModal(previewNote), 300)
                  }} 
                  style={styles.previewActionButton}
                >
                  <Icon name="pencil" size={moderateScale(20)} color="#0077B6" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <ScrollView style={styles.previewBody} showsVerticalScrollIndicator={false}>
            {/* Note Info */}
            <View style={styles.previewBadges}>
              <View style={styles.previewSubjectBadge}>
                <CustomText text={previewNote?.subjectName || ''} textStyle={styles.previewSubjectText} />
              </View>
              {previewNote?.isShared && (
                <View style={styles.previewSharedBadge}>
                  <Icon name="account-group" size={moderateScale(12)} color="#059669" />
                  <CustomText text="Shared with Class" textStyle={styles.previewSharedText} />
                </View>
              )}
            </View>

            {/* Author & Date */}
            <View style={styles.previewMetadata}>
              {previewNote && !previewNote.isOwnNote && previewNote.createdByName && (
                <View style={styles.previewAuthorRow}>
                  <Icon name="account" size={moderateScale(16)} color="#0077B6" />
                  <CustomText text={previewNote.createdByName} textStyle={styles.previewAuthorText} />
                </View>
              )}
              <View style={styles.previewDateRow}>
                <Icon name="clock-outline" size={moderateScale(16)} color="#6B7280" />
                <CustomText 
                  text={previewNote ? formatDate(previewNote.updatedAt) : ''} 
                  textStyle={styles.previewDateText} 
                />
              </View>
            </View>

            {/* Title */}
            <CustomText text={previewNote?.title || ''} textStyle={styles.previewTitle} />

            {/* Content */}
            <View style={[styles.previewContentBox, { backgroundColor: previewNote?.color || '#FEF3C7' }]}>
              <CustomText text={previewNote?.content || ''} textStyle={styles.previewContent} />
            </View>

            {/* Edit/Delete Buttons for Own Notes */}
            {previewNote?.isOwnNote && (
              <View style={styles.previewActions}>
                <TouchableOpacity 
                  style={styles.previewEditButton}
                  onPress={() => {
                    closePreviewModal()
                    setTimeout(() => openEditModal(previewNote), 300)
                  }}
                >
                  <Icon name="pencil" size={moderateScale(18)} color="#FFFFFF" />
                  <CustomText text="Edit Note" textStyle={styles.previewEditButtonText} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.previewDeleteButton}
                  onPress={() => {
                    closePreviewModal()
                    setTimeout(() => handleDeleteNote(previewNote), 300)
                  }}
                >
                  <Icon name="delete" size={moderateScale(18)} color="#EF4444" />
                  <CustomText text="Delete" textStyle={styles.previewDeleteButtonText} />
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

export default StudentNotepad

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(16),
    paddingBottom: moderateScale(8),
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: moderateScale(16),
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: moderateScale(28),
    fontWeight: '700',
    color: '#1A1A2E',
  },
  addButton: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    backgroundColor: '#0077B6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0077B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonText: {
    fontSize: moderateScale(24),
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: -2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(12),
    paddingHorizontal: moderateScale(12),
    marginBottom: moderateScale(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  searchIcon: {
    fontSize: moderateScale(16),
    marginRight: moderateScale(8),
  },
  searchInput: {
    flex: 1,
    fontSize: moderateScale(15),
    color: '#1A1A2E',
    paddingVertical: moderateScale(12),
  },
  viewModeContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: moderateScale(12),
    padding: moderateScale(4),
    marginBottom: moderateScale(12),
  },
  viewModeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(10),
    paddingHorizontal: moderateScale(12),
    borderRadius: moderateScale(10),
    gap: moderateScale(6),
  },
  viewModeButtonActive: {
    backgroundColor: '#0077B6',
    shadowColor: '#0077B6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  viewModeText: {
    fontSize: moderateScale(13),
    fontWeight: '600',
    color: '#6B7280',
  },
  viewModeTextActive: {
    color: '#FFFFFF',
  },
  filterScroll: {
    marginBottom: moderateScale(8),
  },
  filterContent: {
    gap: moderateScale(8),
  },
  filterChip: {
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(8),
    borderRadius: moderateScale(20),
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: '#0077B6',
    borderColor: '#0077B6',
  },
  filterChipText: {
    fontSize: moderateScale(13),
    fontWeight: '500',
    color: '#6B7280',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  notesGrid: {
    paddingHorizontal: moderateScale(16),
    paddingBottom: moderateScale(100),
  },
  noteRow: {
    justifyContent: 'space-between',
  },
  noteCard: {
    width: '48%',
    borderRadius: moderateScale(16),
    padding: moderateScale(16),
    marginBottom: moderateScale(12),
    minHeight: moderateScale(180),
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: moderateScale(8),
  },
  headerBadges: {
    flexDirection: 'column',
    gap: moderateScale(4),
    flex: 1,
  },
  subjectBadge: {
    backgroundColor: 'rgba(0,0,0,0.08)',
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(4),
    borderRadius: moderateScale(12),
    alignSelf: 'flex-start',
  },
  subjectBadgeText: {
    fontSize: moderateScale(11),
    fontWeight: '600',
    color: '#374151',
  },
  sharedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(5, 150, 105, 0.15)',
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(3),
    borderRadius: moderateScale(10),
    gap: moderateScale(3),
    alignSelf: 'flex-start',
  },
  sharedBadgeText: {
    fontSize: moderateScale(10),
    fontWeight: '600',
    color: '#059669',
  },
  shareButton: {
    padding: moderateScale(4),
  },
  shareIcon: {
    fontSize: moderateScale(16),
  },
  noteTitle: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: moderateScale(8),
  },
  noteContent: {
    fontSize: moderateScale(13),
    color: '#4B5563',
    lineHeight: moderateScale(18),
    flex: 1,
  },
  noteFooter: {
    marginTop: moderateScale(8),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noteAuthor: {
    fontSize: moderateScale(10),
    fontWeight: '600',
    color: '#0077B6',
  },
  noteDate: {
    fontSize: moderateScale(11),
    color: '#6B7280',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: moderateScale(60),
    paddingHorizontal: moderateScale(40),
  },
  emptyEmoji: {
    fontSize: moderateScale(48),
    marginBottom: moderateScale(12),
  },
  emptyTitle: {
    fontSize: moderateScale(18),
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: moderateScale(4),
  },
  emptySubtitle: {
    fontSize: moderateScale(14),
    color: '#6B7280',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: moderateScale(20),
    paddingVertical: moderateScale(16),
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalCancel: {
    fontSize: moderateScale(16),
    color: '#6B7280',
  },
  modalTitle: {
    fontSize: moderateScale(18),
    fontWeight: '600',
    color: '#1A1A2E',
  },
  modalSave: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: '#0077B6',
  },
  modalBody: {
    flex: 1,
    padding: moderateScale(20),
  },
  inputLabel: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: '#374151',
    marginBottom: moderateScale(8),
    marginTop: moderateScale(16),
  },
  subjectScroll: {
    marginBottom: moderateScale(8),
  },
  subjectOption: {
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(10),
    borderRadius: moderateScale(12),
    backgroundColor: '#F3F4F6',
    marginRight: moderateScale(8),
  },
  subjectOptionActive: {
    backgroundColor: '#0077B6',
  },
  subjectOptionText: {
    fontSize: moderateScale(14),
    fontWeight: '500',
    color: '#374151',
  },
  subjectOptionTextActive: {
    color: '#FFFFFF',
  },
  colorRow: {
    flexDirection: 'row',
    gap: moderateScale(12),
    marginTop: moderateScale(4),
  },
  colorOption: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: moderateScale(18),
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorOptionActive: {
    borderWidth: 3,
    borderColor: '#374151',
  },
  colorCheck: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#374151',
  },
  titleInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: moderateScale(12),
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(14),
    fontSize: moderateScale(16),
    color: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  contentInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: moderateScale(12),
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(14),
    fontSize: moderateScale(15),
    color: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: moderateScale(200),
    marginBottom: moderateScale(40),
  },
  shareToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: moderateScale(12),
    padding: moderateScale(16),
    marginTop: moderateScale(16),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  shareHintText: {
    fontSize: moderateScale(12),
    color: '#6B7280',
    marginTop: moderateScale(2),
  },
  toggleButton: {
    width: moderateScale(56),
    height: moderateScale(32),
    borderRadius: moderateScale(16),
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    paddingHorizontal: moderateScale(4),
  },
  toggleButtonActive: {
    backgroundColor: '#D1FAE5',
  },
  toggleThumb: {
    width: moderateScale(24),
    height: moderateScale(24),
    borderRadius: moderateScale(12),
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  previewModalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: moderateScale(20),
    paddingVertical: moderateScale(16),
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  previewHeaderActions: {
    flexDirection: 'row',
    gap: moderateScale(16),
  },
  previewActionButton: {
    padding: moderateScale(4),
  },
  previewBody: {
    flex: 1,
    padding: moderateScale(20),
  },
  previewBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: moderateScale(8),
    marginBottom: moderateScale(12),
  },
  previewSubjectBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(6),
    borderRadius: moderateScale(16),
  },
  previewSubjectText: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    color: '#0077B6',
  },
  previewSharedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(6),
    borderRadius: moderateScale(16),
    gap: moderateScale(4),
  },
  previewSharedText: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    color: '#059669',
  },
  previewMetadata: {
    flexDirection: 'row',
    gap: moderateScale(16),
    marginBottom: moderateScale(16),
  },
  previewAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(6),
  },
  previewAuthorText: {
    fontSize: moderateScale(13),
    fontWeight: '600',
    color: '#0077B6',
  },
  previewDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(6),
  },
  previewDateText: {
    fontSize: moderateScale(13),
    color: '#6B7280',
  },
  previewTitle: {
    fontSize: moderateScale(24),
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: moderateScale(16),
    lineHeight: moderateScale(32),
  },
  previewContentBox: {
    borderRadius: moderateScale(16),
    padding: moderateScale(20),
    marginBottom: moderateScale(24),
  },
  previewContent: {
    fontSize: moderateScale(16),
    color: '#374151',
    lineHeight: moderateScale(24),
  },
  previewActions: {
    flexDirection: 'row',
    gap: moderateScale(12),
    marginBottom: moderateScale(40),
  },
  previewEditButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0077B6',
    paddingVertical: moderateScale(14),
    borderRadius: moderateScale(12),
    gap: moderateScale(8),
  },
  previewEditButtonText: {
    fontSize: moderateScale(15),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  previewDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: moderateScale(20),
    paddingVertical: moderateScale(14),
    borderRadius: moderateScale(12),
    gap: moderateScale(8),
  },
  previewDeleteButtonText: {
    fontSize: moderateScale(15),
    fontWeight: '600',
    color: '#EF4444',
  },
})
