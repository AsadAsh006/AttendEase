import React from 'react';
import {
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ImageSourcePropType,
  FlatList,
  View,
} from 'react-native';
import { moderateScale } from 'react-native-size-matters';

export interface SegmentItem {
  label: string;
  icon?: ImageSourcePropType;
  value: string | number;
}

interface SegmentControlProps {
  data: SegmentItem[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

const SegmentControl: React.FC<SegmentControlProps> = ({
  data,
  selectedIndex,
  onSelect,
}) => {
  const renderItem = ({item, index}: {item: SegmentItem; index: number}) => {
    const isSelected = selectedIndex === index;

    return (
      <TouchableOpacity
        onPress={() => onSelect(index)}
        style={[styles.segment, isSelected && styles.segmentSelected]}
        accessibilityRole="button"
        accessibilityState={{selected: isSelected}}
      >
        {item.icon && (
          <Image
            source={item.icon}
            style={[styles.icon, isSelected && styles.iconSelected]}
            resizeMode="contain"
          />
        )}

        <Text style={[styles.text, isSelected && styles.textSelected]}>
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={data}
        keyExtractor={(item) => String(item.value)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  segment: {
    // flex: 1,
    marginHorizontal: 4,
    height: moderateScale(40),
    paddingHorizontal: 12,
    backgroundColor: '#E0E0E0',
    borderRadius: 22,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },

  segmentSelected: {
    backgroundColor: 'white',
  },

  text: {
    color: '#333',
    fontWeight: '600',
  },

  textSelected: {
    color: 'black',
  },

  icon: {
    height: moderateScale(18),
    width: moderateScale(18),
    tintColor: '#333',
  },

  iconSelected: {
    tintColor: '#000',
  },
});

export default SegmentControl;
