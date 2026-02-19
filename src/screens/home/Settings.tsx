import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Image } from 'react-native';
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { moderateScale } from 'react-native-size-matters';
import images from '../../assets/images';

const Settings = () => {
    const settingsOptions = [
        { key: 'profile', label: 'Profile Settings', icon: images.user, color: '#5080BE' },
        { key: 'subjects', label: 'Manage Subjects', icon: images.book, color: '#7EBBDA' },
        { key: 'students', label: 'Manage Students', icon: images.userSettings, color: '#5080BE' },
        { key: 'export', label: 'Export Data', icon: images.download, color: '#7EBBDA' },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Settings</Text>
                <Text style={styles.headerSubtitle}>Manage your preferences</Text>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {settingsOptions.map((option) => (
                    <TouchableOpacity key={option.key} style={styles.settingItem}>
                        <View style={[styles.iconContainer, { backgroundColor: `${option.color}15` }]}>
                            <Image
                                source={option.icon}
                                style={[styles.icon, { tintColor: option.color }]}
                            />
                        </View>
                        <Text style={styles.settingLabel}>{option.label}</Text>
                    </TouchableOpacity>
                ))}

                <View style={styles.versionContainer}>
                    <Text style={styles.versionText}>Version 1.0.0</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default Settings;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#E6F5FA',
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 20,
    },
    headerTitle: {
        fontSize: moderateScale(28),
        fontWeight: '700',
        color: '#1A3A52',
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: moderateScale(15),
        color: '#5080BE',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#5080BE',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
    },
    iconContainer: {
        width: moderateScale(48),
        height: moderateScale(48),
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    icon: {
        width: moderateScale(24),
        height: moderateScale(24),
    },
    settingLabel: {
        flex: 1,
        fontSize: moderateScale(16),
        fontWeight: '600',
        color: '#1A3A52',
    },
    versionContainer: {
        alignItems: 'center',
        paddingVertical: 32,
    },
    versionText: {
        fontSize: moderateScale(14),
        color: '#7EBBDA',
    },
});
